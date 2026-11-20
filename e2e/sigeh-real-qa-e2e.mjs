/**
 * SIGE-H Frontend — Prueba E2E REAL contra Angular + NestJS + PostgreSQL QA (F4-E2)
 *
 * DISTINCIÓN OBLIGATORIA FRENTE A F4-E1:
 * - Tipo de ejecución: `REAL_QA_E2E_NO_MOCKS`
 * - NO levanta ningún servidor mock ni intercepta/simula respuestas HTTP.
 * - Todas las llamadas `/api/v1/*` viajan por HTTP real a través del proxy local de Angular
 *   (`proxy.conf.json`: `/api` -> `http://127.0.0.1:3000`) hacia NestJS + PostgreSQL QA.
 * - Exige pre-flight exitoso en `GET /api/v1/health/ready` (`database.status === "up"`)
 *   y credenciales sintéticas QA vía variables de entorno (nunca hardcodeadas ni guardadas).
 *
 * Variables de entorno requeridas:
 *   SIGEH_QA_IDENTIFICADOR   Identificador sintético QA con asignaciones en /auth/me
 *   SIGEH_QA_PASSWORD        Contraseña sintética QA (nunca se registra en logs ni reportes)
 *
 * Variables opcionales:
 *   SIGEH_E2E_BASE_URL       URL de Angular dev-server (default: http://127.0.0.1:4200)
 *   SIGEH_QA_FECHA           Fecha YYYY-MM-DD para padrón/adscripciones/pases-lista (default: hoy)
 *   SIGEH_QA_HORARIO_ID      UUID opcional de horario para filtrar GET /api/v1/pases-lista
 *   SIGEH_QA_DESDE           Ventana ISO-8601 con offset para programación/tablero (opcional)
 *   SIGEH_QA_HASTA           Ventana ISO-8601 con offset <=168h (opcional)
 *   SIGEH_QA_TEST_401        "1" para probar 1 intento fallido controlado (401) en /login
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const screenshotsDir = path.join(projectRoot, 'docs/frontend/screenshots');
const evidenceDir = path.join(projectRoot, 'docs/frontend/evidence');
const reportPath = path.join(evidenceDir, 'f4e2-real-qa-report.json');
const contractPath = path.join(projectRoot, 'contracts/sigeh-v1.json');

const BASE_URL = (process.env['SIGEH_E2E_BASE_URL'] || 'http://127.0.0.1:4200').replace(/\/$/, '');
const QA_IDENTIFICADOR = (process.env['SIGEH_QA_IDENTIFICADOR'] || '').trim();
const QA_PASSWORD = process.env['SIGEH_QA_PASSWORD'] || '';
const QA_FECHA = (process.env['SIGEH_QA_FECHA'] || '').trim();
const QA_HORARIO_ID = (process.env['SIGEH_QA_HORARIO_ID'] || '').trim();
const QA_DESDE = (process.env['SIGEH_QA_DESDE'] || '').trim();
const QA_HASTA = (process.env['SIGEH_QA_HASTA'] || '').trim();
const QA_TEST_401 = process.env['SIGEH_QA_TEST_401'] === '1';

const EXPECTED_OPENAPI_SHA256 =
  'ab9dd2a4b17806784c029ca16b79a4837542f83ac3ea3a0246cb6b50a18847f0';

const SENSITIVE_QUERY_KEYS = new Set(['password', 'token', 'accessToken', 'refreshToken']);

function sanitizeUrlPath(rawUrl) {
  try {
    const u = new URL(rawUrl, BASE_URL);
    const safeParams = new URLSearchParams();
    for (const [k, v] of u.searchParams.entries()) {
      safeParams.set(k, SENSITIVE_QUERY_KEYS.has(k) ? '[REDACTED]' : v);
    }
    const qs = safeParams.toString();
    return qs ? `${u.pathname}?${qs}` : u.pathname;
  } catch {
    return '[UNPARSEABLE_URL]';
  }
}

class RealQaCdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.requestMetaById = new Map();
    this.sanitizedNetworkLog = [];

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`CDP error: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
        return;
      }

      if (msg.method === 'Network.requestWillBeSent') {
        const { requestId, request } = msg.params;
        if (request?.url?.includes('/api/v1/')) {
          const headers = request.headers || {};
          const hasAuth = Boolean(headers['Authorization'] || headers['authorization']);
          this.requestMetaById.set(requestId, {
            method: request.method,
            path: sanitizeUrlPath(request.url),
            hasBearerHeader: hasAuth,
            startedAtIso: new Date().toISOString(),
          });
        }
      }

      if (msg.method === 'Network.responseReceived') {
        const { requestId, response } = msg.params;
        const meta = this.requestMetaById.get(requestId);
        if (meta) {
          this.sanitizedNetworkLog.push({
            ...meta,
            status: response.status,
            statusText: response.statusText,
            mimeType: response.mimeType,
          });
          this.requestMetaById.delete(requestId);
        }
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`JS eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async waitForSelector(selector, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evalJs(
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      );
      if (exists) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timeout esperando selector: ${selector}`);
  }

  async waitForApiResponse(fromIndex, predicate, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const match = this.sanitizedNetworkLog.slice(fromIndex).find(predicate);
      if (match) return match;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Timeout esperando respuesta HTTP real en sanitizedNetworkLog');
  }

  async waitForAnySelector(selectors, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (const selector of selectors) {
        const exists = await this.evalJs(
          `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
        );
        if (exists) return selector;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timeout esperando cualquiera de: ${selectors.join(', ')}`);
  }

  async click(selector) {
    await this.waitForSelector(selector);
    await this.evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Selector missing: ' + ${JSON.stringify(selector)});
      el.click();
    })()`);
  }

  async setInputValue(selector, value) {
    await this.waitForSelector(selector);
    await this.evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }

  async screenshot(filename, width = 1440, height = 1100) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 500,
    });
    await new Promise((r) => setTimeout(r, 200));
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, filename), Buffer.from(data, 'base64'));
    return `docs/frontend/screenshots/${filename}`;
  }
}

async function launchChromiumCdp() {
  const profileDir = `/tmp/chromium-sigeh-real-qa-${Date.now()}`;
  const child = spawn(
    '/usr/bin/chromium',
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    {
      env: { ...process.env, HOME: '/tmp', XDG_CONFIG_HOME: '/tmp', XDG_CACHE_HOME: '/tmp' },
    },
  );

  const wsBrowserUrl = await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Timeout launching Chromium: ${stderr}`)), 10000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium exited early (${code}): ${stderr}`));
    });
  });

  const debugPort = new URL(wsBrowserUrl).port;
  const targetsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') ?? targets[0];
  assert.ok(pageTarget?.webSocketDebuggerUrl, 'No se encontró target page en Chromium CDP');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  return { child, ws, cdp: new RealQaCdpClient(ws), profileDir };
}

/**
 * Verifica precondiciones reales sin mocks:
 * 1) Angular dev-server respondiendo en BASE_URL.
 * 2) Proxy `/api` enrutando hacia NestJS + PostgreSQL QA real (`/api/v1/health/ready` y `/api/v1/meta/version`).
 */
async function runRealQaPreflight() {
  if (!QA_IDENTIFICADOR || !QA_PASSWORD) {
    throw new Error(
      'PRECONDICIÓN FALTANTE: Defina SIGEH_QA_IDENTIFICADOR y SIGEH_QA_PASSWORD (credenciales sintéticas QA) antes de ejecutar F4-E2.',
    );
  }

  let versionRes;
  let readyRes;
  try {
    versionRes = await fetch(`${BASE_URL}/api/v1/meta/version`, {
      headers: { Accept: 'application/json' },
    });
    readyRes = await fetch(`${BASE_URL}/api/v1/health/ready`, {
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    throw new Error(
      `PRECONDICIÓN FALLIDA: No hay respuesta en ${BASE_URL}/api/v1/* (verifique que 'npm start' y NestJS QA estén activos): ${err.message}`,
    );
  }

  assert.equal(versionRes.status, 200, `GET /api/v1/meta/version devolvió ${versionRes.status}`);
  const versionBody = await versionRes.json();
  assert.equal(versionBody.apiBasePath, '/api/v1', 'Prefijo contractual inesperado');

  assert.equal(
    readyRes.status,
    200,
    `GET /api/v1/health/ready devolvió ${readyRes.status} (PostgreSQL QA no listo)`,
  );
  const readyBody = await readyRes.json();
  assert.equal(readyBody.status, 'ok', 'Health ready status !== ok');
  assert.equal(readyBody.database?.status, 'up', 'PostgreSQL QA database.status !== up');
  assert.equal(
    readyBody.database?.schemaVerified,
    true,
    'PostgreSQL QA schemaVerified !== true',
  );

  return { versionBody, readyBody };
}

/**
 * Verifica rotación real de sesión IAM (`login` -> `refresh` -> `me` -> `logout`)
 * contra el proxy `/api` sin mocks y sin persistir ningún token ni contraseña.
 */
async function verifyRealRefreshRotationViaProxy() {
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ identificador: QA_IDENTIFICADOR, password: QA_PASSWORD }),
  });
  assert.equal(
    loginRes.status,
    200,
    `Login de verificación de refresh devolvió HTTP ${loginRes.status}`,
  );
  const tokens1 = await loginRes.json();
  assert.ok(tokens1.accessToken && tokens1.refreshToken && tokens1.sessionId);

  let latestAccessToken = tokens1.accessToken;
  try {
    const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: tokens1.refreshToken }),
    });
    assert.equal(
      refreshRes.status,
      200,
      `POST /api/v1/auth/refresh real devolvió HTTP ${refreshRes.status}`,
    );
    const tokens2 = await refreshRes.json();
    assert.ok(tokens2.accessToken && tokens2.refreshToken);
    assert.notEqual(
      tokens2.refreshToken,
      tokens1.refreshToken,
      'El refreshToken rotado debe ser distinto al anterior',
    );
    latestAccessToken = tokens2.accessToken;

    const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${latestAccessToken}`, Accept: 'application/json' },
    });
    assert.equal(
      meRes.status,
      200,
      `GET /api/v1/auth/me con accessToken rotado devolvió HTTP ${meRes.status}`,
    );

    return {
      loginStatus: loginRes.status,
      refreshStatus: refreshRes.status,
      meAfterRefreshStatus: meRes.status,
      tokenRotated: true,
    };
  } finally {
    await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${latestAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }).catch(() => {});
  }
}

async function run() {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const contractSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(contractPath))
    .digest('hex');
  assert.equal(
    contractSha256,
    EXPECTED_OPENAPI_SHA256,
    `SHA-256 inesperado en contracts/sigeh-v1.json (${contractSha256})`,
  );

  const steps = [];
  const screenshots = [];

  const preflight = await runRealQaPreflight();
  steps.push({
    step: '1/11 Pre-flight real proxy /api -> NestJS + PostgreSQL QA',
    status: 'PASS',
    detail: `apiVersion=${preflight.versionBody.apiVersion}, db=${preflight.readyBody.database.status}, schemaVerified=${preflight.readyBody.database.schemaVerified}`,
  });

  const browser = await launchChromiumCdp();
  try {
    const { cdp } = browser;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 2. Arranque predeterminado seguro en SYNTHETIC_DEMO (cero /api, cero Web Storage)
    await cdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` });
    await cdp.waitForSelector('[data-testid="synthetic-demo-banner"]');
    const storage1 = await cdp.evalJs(
      '({ ls: window.localStorage.length, ss: window.sessionStorage.length })',
    );
    assert.equal(storage1.ls, 0);
    assert.equal(storage1.ss, 0);
    assert.equal(
      cdp.sanitizedNetworkLog.length,
      0,
      'En arranque SYNTHETIC_DEMO no debe emitirse tráfico /api/v1/*',
    );
    steps.push({
      step: '2/11 Arranque predeterminado SYNTHETIC_DEMO (iamEnabled=false, 0 tráfico /api)',
      status: 'PASS',
    });

    // 3. Activación explícita QA en RAM + verificación de iamAuthGuard
    await cdp.click('[data-testid="nav-iam-login"]');
    await cdp.waitForSelector('[data-testid="btn-activate-qa-session"]');
    await cdp.click('[data-testid="btn-activate-qa-session"]');
    await cdp.click('[data-testid="nav-personal"]');
    await new Promise((r) => setTimeout(r, 300));
    const guardedUrl = await cdp.evalJs('window.location.pathname + window.location.search');
    assert.equal(guardedUrl, '/login?returnUrl=%2Fpersonal');

    if (QA_TEST_401) {
      await cdp.setInputValue('[data-testid="input-identificador"]', QA_IDENTIFICADOR);
      await cdp.setInputValue('[data-testid="input-password"]', 'invalid-qa-password-check');
      await cdp.click('[data-testid="btn-submit-login"]');
      await cdp.waitForSelector('[data-testid="auth-http-error"]');
    }
    steps.push({
      step: '3/11 Activación QA en memoria RAM y bloqueo de rutas con iamAuthGuard',
      status: 'PASS',
      detail: QA_TEST_401 ? 'Incluyó comprobación de error 401 controlada' : 'Sin prueba 401 opcional',
    });

    // 4. Login real -> /auth/me -> selección de contexto autorizado
    await cdp.setInputValue('[data-testid="input-identificador"]', QA_IDENTIFICADOR);
    await cdp.setInputValue('[data-testid="input-password"]', QA_PASSWORD);
    await cdp.click('[data-testid="btn-submit-login"]');
    await cdp.waitForSelector('[data-testid="personnel-v1-projection-notice"]');

    await cdp.click('[data-testid="nav-iam-login"]');
    await cdp.waitForSelector('[data-testid="authenticated-session-card"]');
    const authStorage = await cdp.evalJs(
      '({ ls: window.localStorage.length, ss: window.sessionStorage.length })',
    );
    assert.equal(authStorage.ls, 0, 'localStorage debe permanecer vacío tras login real');
    assert.equal(authStorage.ss, 0, 'sessionStorage debe permanecer vacío tras login real');
    const contextInfo = await cdp.evalJs(`({
      hospitals: document.querySelectorAll('[data-testid="select-authorized-hospital"] option').length,
      services: document.querySelectorAll('[data-testid="select-authorized-service"] option').length,
    })`);
    screenshots.push(await cdp.screenshot('f4e2-real-login-desktop.png', 1440, 1100));
    steps.push({
      step: '4/11 Login real -> /auth/me -> contexto autorizado en RAM (0 Web Storage)',
      status: 'PASS',
      detail: `hospitals=${contextInfo.hospitals}, services=${contextInfo.services}`,
    });

    // 5. Personal real -> Detalle -> Adscripciones (+ cambio de ámbito si hay >=2 servicios)
    await cdp.click('[data-testid="nav-personal"]');
    await cdp.waitForSelector('[data-testid="personnel-v1-projection-notice"]');
    if (QA_FECHA) {
      await cdp.setInputValue('[data-testid="input-openapi-fecha"]', QA_FECHA);
    }
    const staffOutcome = await cdp.waitForAnySelector([
      '[data-testid="personnel-table"]',
      '[data-testid="state-panel-empty"]',
      '[data-testid="state-panel-error"]',
      '[data-testid="state-panel-forbidden"]',
    ]);
    let detailStatus = 'sin filas en fecha consultada';
    if (staffOutcome === '[data-testid="personnel-table"]') {
      const firstRowSelector = await cdp.evalJs(`(() => {
        const row = document.querySelector('[data-testid^="personnel-row-"]');
        return row ? '[data-testid="' + row.getAttribute('data-testid') + '"]' : null;
      })()`);
      if (firstRowSelector) {
        await cdp.click(firstRowSelector);
        const detailOut = await cdp.waitForAnySelector([
          '[data-testid="openapi-employee-summary"]',
          '[data-testid="state-panel-error"]',
          '[data-testid="state-panel-forbidden"]',
        ]);
        detailStatus = `detalle=${detailOut}`;
        const contractBtn = await cdp.evalJs(`(() => {
          const btn = document.querySelector('[data-testid^="btn-load-contract-"]');
          return btn ? '[data-testid="' + btn.getAttribute('data-testid') + '"]' : null;
        })()`);
        if (contractBtn) {
          await cdp.click(contractBtn);
          const caOut = await cdp.waitForAnySelector([
            '[data-testid="contract-assignments-list"]',
            '[data-testid="state-panel-empty"]',
            '[data-testid="state-panel-error"]',
          ]);
          detailStatus += `, adscripciones=${caOut}`;
        }
      }
    }
    screenshots.push(await cdp.screenshot('f4e2-real-personal-desktop.png', 1440, 1100));
    steps.push({
      step: '5/11 Personal -> Detalle -> Adscripciones por contrato (HTTP real)',
      status: staffOutcome === '[data-testid="personnel-table"]' || staffOutcome === '[data-testid="state-panel-empty"]' ? 'PASS' : 'FAIL',
      detail: `padrón=${staffOutcome}; ${detailStatus}`,
    });

    // 6. Cambio de ámbito hospitalario/servicio (si hay >=2 servicios autorizados)
    const serviceSwitchDetail = await cdp.evalJs(`(() => {
      const sel = document.querySelector('[data-testid="select-openapi-service"]');
      if (!sel || sel.options.length < 2) return { switched: false, count: sel ? sel.options.length : 0 };
      sel.value = sel.options[1].value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { switched: true, count: sel.options.length };
    })()`);
    if (serviceSwitchDetail.switched) {
      await cdp.waitForAnySelector([
        '[data-testid="personnel-table"]',
        '[data-testid="state-panel-empty"]',
        '[data-testid="state-panel-forbidden"]',
      ]);
      const residualDetail = await cdp.evalJs(
        'Boolean(document.querySelector(\'[data-testid="openapi-employee-summary"]\'))',
      );
      assert.equal(residualDetail, false, 'Al cambiar servicio no debe quedar detalle residual');
    }
    steps.push({
      step: '6/11 Cambio entre ámbitos autorizados sin exposición residual',
      status: 'PASS',
      detail: serviceSwitchDetail.switched
        ? `Cambio ejecutado entre ${serviceSwitchDetail.count} servicios y detalle previo limpiado`
        : `Usuario QA cuenta con ${serviceSwitchDetail.count} servicio(s); se requiere >=2 para alternar`,
    });

    // 7. Programación real + validación ventana > 168 h
    await cdp.click('[data-testid="nav-programacion"]');
    await cdp.waitForSelector('[data-testid="scheduling-v1-semantic-notice"]');
    if (QA_DESDE && QA_HASTA) {
      await cdp.setInputValue('[data-testid="input-sched-desde"]', QA_DESDE);
      await cdp.setInputValue('[data-testid="input-sched-hasta"]', QA_HASTA);
    }
    const schedOutcome = await cdp.waitForAnySelector([
      '[data-testid="openapi-scheduling-table"]',
      '[data-testid="state-panel-empty"]',
      '[data-testid="state-panel-error"]',
      '[data-testid="state-panel-forbidden"]',
    ]);
    screenshots.push(await cdp.screenshot('f4e2-real-programacion-desktop.png', 1440, 1100));
    steps.push({
      step: '7/11 Programación laboral real (GET /api/v1/programaciones)',
      status: schedOutcome === '[data-testid="openapi-scheduling-table"]' || schedOutcome === '[data-testid="state-panel-empty"]' ? 'PASS' : 'FAIL',
      detail: `resultado=${schedOutcome}`,
    });

    // 8. Tablero de Coordinación real (PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA)
    await cdp.click('[data-testid="nav-dashboard"]');
    await cdp.waitForSelector('[data-testid="dashboard-semantic-disclaimer"]');
    if (QA_DESDE && QA_HASTA) {
      await cdp.setInputValue('[data-testid="input-dash-desde"]', QA_DESDE);
      await cdp.setInputValue('[data-testid="input-dash-hasta"]', QA_HASTA);
    }
    const dashOutcome = await cdp.waitForAnySelector([
      '[data-testid="coordination-programming-panel"]',
      '[data-testid="state-panel-error"]',
      '[data-testid="state-panel-forbidden"]',
    ]);
    if (dashOutcome === '[data-testid="coordination-programming-panel"]') {
      const hasSyntheticKpis = await cdp.evalJs(
        'Boolean(document.querySelector(\'[data-testid="kpi-cards-grid"]\'))',
      );
      assert.equal(hasSyntheticKpis, false, 'En modo real no deben renderizarse KPIs sintéticos');
    }
    screenshots.push(await cdp.screenshot('f4e2-real-dashboard-desktop.png', 1440, 1100));
    screenshots.push(await cdp.screenshot('f4e2-real-dashboard-mobile.png', 390, 960));
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    steps.push({
      step: '8/11 Tablero de Coordinación real (PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA)',
      status: dashOutcome === '[data-testid="coordination-programming-panel"]' ? 'PASS' : 'FAIL',
      detail: `resultado=${dashOutcome}`,
    });

    // 9. Consulta real de Pases de Lista (GET /api/v1/pases-lista — F4-E2B, solo lectura)
    const rosterLogStart = cdp.sanitizedNetworkLog.length;
    await cdp.click('[data-testid="nav-pases-lista"]');
    await cdp.waitForSelector('[data-testid="roster-semantic-separation-notice"]');
    await cdp.waitForAnySelector([
      '[data-testid="attendance-roster-table"]',
      '[data-testid="state-panel-empty"]',
      '[data-testid="state-panel-forbidden"]',
      '[data-testid="state-panel-error"]',
    ]);
    if (QA_FECHA) {
      const idxBeforeFecha = cdp.sanitizedNetworkLog.length;
      await cdp.setInputValue('[data-testid="input-roster-fecha"]', QA_FECHA);
      await cdp.waitForApiResponse(
        idxBeforeFecha,
        (e) => e.method === 'GET' && e.path.startsWith('/api/v1/pases-lista') && e.path.includes(`fecha=${QA_FECHA}`),
      );
    }
    if (QA_HORARIO_ID) {
      const idxBeforeHorario = cdp.sanitizedNetworkLog.length;
      await cdp.setInputValue('[data-testid="input-roster-horario-id"]', QA_HORARIO_ID);
      await cdp.waitForApiResponse(
        idxBeforeHorario,
        (e) =>
          e.method === 'GET' &&
          e.path.startsWith('/api/v1/pases-lista') &&
          e.path.includes(`horarioId=${QA_HORARIO_ID}`),
      );
    }
    const rosterOutcome = await cdp.waitForAnySelector([
      '[data-testid="attendance-roster-table"]',
      '[data-testid="state-panel-empty"]',
      '[data-testid="state-panel-forbidden"]',
      '[data-testid="state-panel-error"]',
    ]);
    const rosterChecks = await cdp.evalJs(`(() => {
      const notice = document.querySelector('[data-testid="roster-semantic-separation-notice"]')?.innerText || '';
      const tableEl = document.querySelector('[data-testid="attendance-roster-table"]');
      const tableText = tableEl ? tableEl.innerText : '';
      const headerSub = document.querySelector('#heading-roster-table')?.parentElement?.innerText || '';
      const rowCount = document.querySelectorAll('[data-testid^="roster-row-"]').length;
      const fechaValue = document.querySelector('[data-testid="input-roster-fecha"]')?.value || '';
      const selectedHospitalId = document.querySelector('[data-testid="select-roster-hospital"]')?.value || '';
      const selectedServiceId = document.querySelector('[data-testid="select-roster-service"]')?.value || '';
      return {
        hasSemanticSeparation:
          notice.includes('asistencia operativa capturada') &&
          notice.includes('cobertura efectiva') &&
          notice.includes('incidencias administrativas'),
        rowCount,
        fechaValue,
        selectedHospitalId,
        selectedServiceId,
        hasOperationalState: /(PRESENTE|AUSENTE|PARCIAL|PENDIENTE|NO_EXIGIBLE)/.test(tableText),
        hasTraceability: tableText.includes('Autor:') || tableText.includes('Sin captura registrada'),
        hasScopeAndTimezone:
          headerSub.includes('Zona horaria hospital:') &&
          headerSub.includes('Ámbito:') &&
          (fechaValue ? headerSub.includes(fechaValue) : true),
        containsSensitivePassword: document.body.innerText.includes(${JSON.stringify(QA_PASSWORD)}),
      };
    })()`);
    assert.equal(
      rosterChecks.hasSemanticSeparation,
      true,
      'Debe mostrar separación semántica de asistencia respecto de programación, cobertura e incidencias',
    );
    assert.equal(
      rosterChecks.containsSensitivePassword,
      false,
      'Nunca debe exponerse la contraseña en el DOM de /pases-lista',
    );
    const pasesListaCalls = cdp.sanitizedNetworkLog
      .slice(rosterLogStart)
      .filter((entry) => entry.path.startsWith('/api/v1/pases-lista'));
    const asistenciaWriteCalls = cdp.sanitizedNetworkLog
      .slice(rosterLogStart)
      .filter((entry) => entry.path.includes('/asistencia') || entry.method === 'PUT');
    assert.ok(
      pasesListaCalls.length >= 1 && pasesListaCalls.every((c) => c.method === 'GET' && c.hasBearerHeader),
      'Debe emitirse al menos un GET real con Bearer a /api/v1/pases-lista (sin escrituras ni mocks)',
    );
    assert.equal(
      asistenciaWriteCalls.length,
      0,
      'Coordinación Angular es de solo lectura y nunca debe invocar PUT .../asistencia',
    );
    screenshots.push(await cdp.screenshot('f4e2-real-pases-lista-desktop.png', 1440, 1100));
    screenshots.push(await cdp.screenshot('f4e2-real-pases-lista-mobile.png', 390, 960));
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Comprobar limpieza y recarga en /pases-lista al cambiar de servicio autorizado (si existen >=2)
    const idxBeforeServiceSwitch = cdp.sanitizedNetworkLog.length;
    const rosterServiceSwitch = await cdp.evalJs(`(() => {
      const sel = document.querySelector('[data-testid="select-roster-service"]');
      if (!sel || sel.options.length < 2) return { switched: false, count: sel ? sel.options.length : 0, nextValue: '' };
      const nextIdx = sel.selectedIndex === 0 ? 1 : 0;
      const nextValue = sel.options[nextIdx].value;
      sel.value = nextValue;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { switched: true, count: sel.options.length, nextValue };
    })()`);
    if (rosterServiceSwitch.switched) {
      await cdp.waitForApiResponse(
        idxBeforeServiceSwitch,
        (e) =>
          e.method === 'GET' &&
          e.path.startsWith('/api/v1/pases-lista') &&
          e.path.includes(`servicioId=${rosterServiceSwitch.nextValue}`),
      );
      await cdp.waitForAnySelector([
        '[data-testid="attendance-roster-table"]',
        '[data-testid="state-panel-empty"]',
        '[data-testid="state-panel-forbidden"]',
        '[data-testid="state-panel-error"]',
      ]);
      const staleServiceCheck = await cdp.evalJs(`(() => {
        const headerSub = document.querySelector('#heading-roster-table')?.parentElement?.innerText || '';
        return { headerSub };
      })()`);
      if (staleServiceCheck.headerSub) {
        assert.ok(
          !staleServiceCheck.headerSub.includes(rosterChecks.selectedServiceId) ||
            rosterServiceSwitch.nextValue === rosterChecks.selectedServiceId,
          'Al cambiar de servicio en /pases-lista no deben persistir filas del servicio anterior',
        );
      }
    }

    // Comprobar limpieza y recarga en /pases-lista al cambiar de hospital autorizado (si existen >=2)
    const idxBeforeHospitalSwitch = cdp.sanitizedNetworkLog.length;
    const rosterHospitalSwitch = await cdp.evalJs(`(() => {
      const sel = document.querySelector('[data-testid="select-roster-hospital"]');
      if (!sel || sel.options.length < 2) return { switched: false, count: sel ? sel.options.length : 0, nextValue: '' };
      const nextIdx = sel.selectedIndex === 0 ? 1 : 0;
      const nextValue = sel.options[nextIdx].value;
      sel.value = nextValue;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { switched: true, count: sel.options.length, nextValue };
    })()`);
    if (rosterHospitalSwitch.switched) {
      await cdp.waitForAnySelector([
        '[data-testid="attendance-roster-table"]',
        '[data-testid="state-panel-empty"]',
        '[data-testid="state-panel-forbidden"]',
        '[data-testid="state-panel-error"]',
      ]);
      const hospitalCleanCheck = await cdp.evalJs(`(() => {
        const headerSub = document.querySelector('#heading-roster-table')?.parentElement?.innerText || '';
        const selectedHospitalId = document.querySelector('[data-testid="select-roster-hospital"]')?.value || '';
        return { headerSub, selectedHospitalId };
      })()`);
      assert.equal(hospitalCleanCheck.selectedHospitalId, rosterHospitalSwitch.nextValue);
      if (hospitalCleanCheck.headerSub) {
        assert.ok(
          !hospitalCleanCheck.headerSub.includes(rosterChecks.selectedHospitalId),
          'Al cambiar de hospital en /pases-lista no deben persistir datos del hospital anterior',
        );
      }
      const hospitalSwitchCalls = cdp.sanitizedNetworkLog
        .slice(idxBeforeHospitalSwitch)
        .filter((e) => e.path.startsWith('/api/v1/pases-lista'));
      assert.ok(
        hospitalSwitchCalls.every(
          (e) => e.method === 'GET' && e.path.includes(`hospitalId=${rosterHospitalSwitch.nextValue}`),
        ),
        'Cualquier solicitud tras cambiar de hospital debe apuntar exclusivamente al nuevo hospital autorizado',
      );
    }

    const rosterPass =
      rosterOutcome === '[data-testid="attendance-roster-table"]' ||
      rosterOutcome === '[data-testid="state-panel-empty"]';
    steps.push({
      step: '9/11 Consulta real de Pases de Lista (GET /api/v1/pases-lista, trazabilidad y separación semántica)',
      status: rosterPass ? 'PASS' : 'FAIL',
      detail: `resultado=${rosterOutcome}, filas=${rosterChecks.rowCount}, estados=${rosterChecks.hasOperationalState}, trazabilidad=${rosterChecks.hasTraceability}, ambitoYZona=${rosterChecks.hasScopeAndTimezone}, cambioServicio=${rosterServiceSwitch.switched}, cambioHospital=${rosterHospitalSwitch.switched}`,
    });

    // 10. Sesiones persistentes en UI + verificación de rotación real de refreshToken vía proxy /api
    await cdp.click('[data-testid="nav-iam-login"]');
    await cdp.click('[data-testid="btn-load-sessions"]');
    await cdp.waitForSelector('[data-testid="session-list"]');
    const refreshCheck = await verifyRealRefreshRotationViaProxy();
    steps.push({
      step: '10/11 Listado de sesiones (/auth/sessions) y rotación real de refreshToken (/auth/refresh)',
      status: 'PASS',
      detail: JSON.stringify(refreshCheck),
    });

    // 11. Logout real -> limpieza total (incluyendo pases de lista) -> restauración a SYNTHETIC_DEMO
    await cdp.click('[data-testid="btn-header-logout"]');
    await cdp.waitForSelector('[data-testid="login-form-card"]');
    const storageEnd = await cdp.evalJs(
      '({ ls: window.localStorage.length, ss: window.sessionStorage.length, hasRosterTable: Boolean(document.querySelector(\'[data-testid="attendance-roster-table"]\')) })',
    );
    assert.equal(storageEnd.ls, 0);
    assert.equal(storageEnd.ss, 0);
    assert.equal(storageEnd.hasRosterTable, false, 'Al cerrar sesión no deben quedar filas de pases de lista');
    await cdp.click('[data-testid="btn-restore-synthetic-demo"]');
    steps.push({
      step: '11/11 Logout real (POST /api/v1/auth/logout), limpieza RAM/pases-lista y retorno a SYNTHETIC_DEMO',
      status: 'PASS',
    });

    const overallPass = steps.every((s) => s.status === 'PASS');
    const report = {
      executionKind: 'REAL_QA_E2E_NO_MOCKS',
      executedAtIso: new Date().toISOString(),
      targetBaseUrl: BASE_URL,
      openApiContractSha256: contractSha256,
      overallStatus: overallPass ? 'PASS' : 'FAIL',
      preflight: {
        apiVersion: preflight.versionBody,
        healthReady: preflight.readyBody,
      },
      steps,
      screenshots,
      sanitizedNetworkLog: cdp.sanitizedNetworkLog,
    };

    const serializedReport = JSON.stringify(report, null, 2);
    assert.equal(
      serializedReport.includes(QA_PASSWORD),
      false,
      'El reporte sanitizado jamás debe contener la contraseña QA',
    );
    assert.equal(
      /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/.test(serializedReport),
      false,
      'El reporte sanitizado jamás debe contener JWT ni Bearer tokens',
    );
    fs.writeFileSync(reportPath, serializedReport);
    console.log('\n=== PRUEBA E2E REAL CONTRA ANGULAR + NESTJS + POSTGRESQL QA (SIN MOCKS) ===');
    for (const s of steps) {
      console.log(`${s.status} — ${s.step}${s.detail ? ` (${s.detail})` : ''}`);
    }
    console.log(`Evidencia sanitizada escrita en: ${reportPath}`);
    console.log(`ESTADO FINAL F4-E2 REAL QA: ${report.overallStatus}\n`);
    if (!overallPass) process.exit(1);
  } finally {
    browser.ws.close();
    browser.child.kill('SIGTERM');
    fs.rmSync(browser.profileDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('FAIL / BLOCKED F4-E2 REAL QA:', err.message || err);
  process.exit(1);
});
