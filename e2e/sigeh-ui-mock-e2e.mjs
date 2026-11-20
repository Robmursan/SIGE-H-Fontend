/**
 * SIGE-H Frontend — Pruebas E2E de Interfaz con Mocks Contractuales (F4-E1)
 *
 * ETIQUETA OBLIGATORIA:
 * Estas son PRUEBAS E2E DE INTERFAZ CON MOCKS CONTRACTUALES sobre Chromium real
 * y el bundle compilado de Angular (`dist/SIGE-H-Frontend/browser`).
 * NO constituyen validación E2E contra NestJS ni PostgreSQL QA real (F4-E2).
 *
 * Recorrido automatizado verificado:
 * 1. Arranque seguro en SYNTHETIC_DEMO (iamEnabled = false, cero tráfico /api, cero Web Storage).
 * 2. Activación explícita QA en memoria (/login) + redirección de iamAuthGuard.
 * 3. Login -> /auth/me -> selección de contexto autorizado (hospital/servicio).
 * 4. Personal (GET /api/v1/empleados) -> Detalle -> Adscripciones por contrato.
 * 5. Programación (GET /api/v1/programaciones) con aviso de cobertura no disponible.
 * 6. Tablero de Coordinación (GET /api/v1/tableros/coordinacion) con semántica
 *    PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA y bloques no disponibles sin relleno sintético.
 * 7. Logout (POST /api/v1/auth/logout), limpieza total de memoria RAM y restauración segura a Demo.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist/SIGE-H-Frontend/browser');
const screenshotsDir = path.join(projectRoot, 'docs/frontend/screenshots');

const MOCK_IDS = {
  sessionId: '10101010-1010-4010-8010-101010101010',
  usuarioId: '20202020-2020-4020-8020-202020202020',
  hospitalId: '11111111-1111-4111-8111-111111111111',
  divisionId: '22222222-2222-4222-8222-222222222222',
  servicioId1: '33333333-3333-4333-8333-333333333333',
  servicioId2: '99999999-9999-4999-8999-999999999999',
  empleadoId: '44444444-4444-4444-8444-444444444444',
  contratoId: '66666666-6666-4666-8666-666666666666',
  adscripcionId: '77777777-7777-4777-8777-777777777777',
  programacionId: '88888888-8888-4888-8888-888888888888',
  accessToken: 'mock-e2e-access-token-v1',
  refreshToken: 'a'.repeat(64),
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('FAIL: dist/SIGE-H-Frontend/browser no existe. Ejecute `npm run build` antes.');
  process.exit(1);
}
fs.mkdirSync(screenshotsDir, { recursive: true });

const recordedApiCalls = [];

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function createMockAndStaticServer() {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = reqUrl.pathname;

    if (pathname.startsWith('/api/v1/')) {
      const authHeader = req.headers['authorization'] || '';
      recordedApiCalls.push({
        method: req.method,
        path: pathname,
        query: reqUrl.search,
        hasBearer: authHeader.startsWith('Bearer '),
      });

      if (req.method === 'POST' && pathname === '/api/v1/auth/login') {
        const body = await readJsonBody(req);
        if (!body.identificador || !body.password) {
          return sendJson(res, 400, { statusCode: 400, message: 'Entrada inválida', error: 'Bad Request' });
        }
        return sendJson(res, 200, {
          accessToken: MOCK_IDS.accessToken,
          refreshToken: MOCK_IDS.refreshToken,
          tokenType: 'Bearer',
          expiresIn: 300,
          sessionId: MOCK_IDS.sessionId,
        });
      }

      if (authHeader !== `Bearer ${MOCK_IDS.accessToken}`) {
        return sendJson(res, 401, { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' });
      }

      if (req.method === 'GET' && pathname === '/api/v1/auth/me') {
        return sendJson(res, 200, {
          usuarioId: MOCK_IDS.usuarioId,
          sessionId: MOCK_IDS.sessionId,
          provider: 'local',
          assignments: [
            {
              kind: 'TITULAR',
              scope: {
                hospitalId: MOCK_IDS.hospitalId,
                divisionId: MOCK_IDS.divisionId,
                servicioId: MOCK_IDS.servicioId1,
              },
              permissions: ['PERSONAL_LEER', 'PROGRAMACION_LEER', 'TABLERO_LEER'],
            },
            {
              kind: 'ENCARGADO',
              scope: {
                hospitalId: MOCK_IDS.hospitalId,
                divisionId: MOCK_IDS.divisionId,
                servicioId: MOCK_IDS.servicioId2,
              },
              permissions: ['PERSONAL_LEER', 'PROGRAMACION_LEER'],
            },
          ],
        });
      }

      if (req.method === 'POST' && pathname === '/api/v1/auth/logout') {
        res.writeHead(204);
        return res.end();
      }

      if (req.method === 'GET' && pathname === '/api/v1/empleados') {
        return sendJson(res, 200, {
          items: [
            {
              empleadoId: MOCK_IDS.empleadoId,
              nombres: 'Sofía',
              primerApellido: 'Ramírez',
              activo: true,
            },
          ],
          nextCursor: null,
          limit: 25,
          order: 'id:asc',
        });
      }

      if (req.method === 'GET' && pathname === `/api/v1/empleados/${MOCK_IDS.empleadoId}`) {
        return sendJson(res, 200, {
          empleado: {
            empleadoId: MOCK_IDS.empleadoId,
            nombres: 'Sofía',
            primerApellido: 'Ramírez',
            activo: true,
          },
          adscripciones: {
            items: [
              {
                adscripcionId: MOCK_IDS.adscripcionId,
                contratoId: MOCK_IDS.contratoId,
                servicioId: MOCK_IDS.servicioId1,
                clase: 'OPERATIVA',
                inicio: '2026-01-15',
                fin: null,
              },
            ],
            nextCursor: null,
            limit: 25,
            order: 'id:asc',
          },
        });
      }

      if (req.method === 'GET' && pathname === `/api/v1/contratos/${MOCK_IDS.contratoId}/adscripciones`) {
        return sendJson(res, 200, {
          items: [
            {
              adscripcionId: MOCK_IDS.adscripcionId,
              contratoId: MOCK_IDS.contratoId,
              servicioId: MOCK_IDS.servicioId1,
              clase: 'OPERATIVA',
              inicio: '2026-01-15',
              fin: null,
            },
          ],
          nextCursor: null,
          limit: 25,
          order: 'id:asc',
        });
      }

      if (req.method === 'GET' && pathname === '/api/v1/programaciones') {
        return sendJson(res, 200, {
          items: [
            {
              programacionId: MOCK_IDS.programacionId,
              empleadoId: MOCK_IDS.empleadoId,
              servicioId: MOCK_IDS.servicioId1,
              horarioId: null,
              turnoCodigo: 'MAT',
              inicioProgramado: '2026-11-18T07:00:00-06:00',
              finProgramado: '2026-11-18T15:00:00-06:00',
              estado: 'PROGRAMADA',
            },
          ],
          nextCursor: null,
          limit: 50,
          order: 'id:asc',
        });
      }

      if (req.method === 'GET' && pathname === '/api/v1/tableros/coordinacion') {
        return sendJson(res, 200, {
          base: 'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA',
          jornadas: 42,
          empleadosProgramados: 18,
          programadas: 35,
          canceladas: 2,
          sustituidas: 3,
          cerradas: 2,
          horasPersonaProgramadas: 312.5,
        });
      }

      return sendJson(res, 404, { statusCode: 404, message: 'Mock endpoint not found', error: 'Not Found' });
    }

    // Servir bundle Angular estático (mismo origen)
    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
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

  async waitForSelector(selector, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evalJs(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (exists) return;
      await new Promise((r) => setTimeout(r, 80));
    }
    throw new Error(`Timeout esperando selector: ${selector}`);
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
    await new Promise((r) => setTimeout(r, 180));
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, filename), Buffer.from(data, 'base64'));
  }
}

async function launchChromiumCdp() {
  const profileDir = `/tmp/chromium-sigeh-e2e-${Date.now()}`;
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

  return { child, ws, cdp: new CdpClient(ws), profileDir };
}

async function run() {
  const server = createMockAndStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const results = [];

  const browser = await launchChromiumCdp();
  try {
    const { cdp } = browser;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 1. Arranque por defecto en SYNTHETIC_DEMO (cero /api, cero Web Storage)
    await cdp.send('Page.navigate', { url: `${baseUrl}/dashboard` });
    await cdp.waitForSelector('[data-testid="synthetic-demo-banner"]');
    await cdp.waitForSelector('[data-testid="kpi-cards-grid"]');
    const storageCheck1 = await cdp.evalJs(
      '({ ls: window.localStorage.length, ss: window.sessionStorage.length })',
    );
    assert.equal(storageCheck1.ls, 0);
    assert.equal(storageCheck1.ss, 0);
    assert.equal(recordedApiCalls.length, 0, 'En modo predeterminado SYNTHETIC_DEMO no debe haber llamadas /api/v1/*');
    await cdp.screenshot('f4e1-dashboard-synthetic-desktop.png', 1440, 1100);
    results.push('PASS 1/8: Arranque seguro en SYNTHETIC_DEMO (iamEnabled=false, 0 llamadas /api, 0 Web Storage)');

    // 2. Activación explícita de Integración QA en /login y verificación de guard
    await cdp.click('[data-testid="nav-iam-login"]');
    await cdp.waitForSelector('[data-testid="qa-mode-activation-panel"]');
    await cdp.click('[data-testid="btn-activate-qa-session"]');
    await cdp.waitForSelector('[data-testid="auth-status-feedback"]');
    // Navegar a /personal sin autenticar debe redirigir a /login?returnUrl=%2Fpersonal
    await cdp.click('[data-testid="nav-personal"]');
    await new Promise((r) => setTimeout(r, 250));
    const guardedUrl = await cdp.evalJs('window.location.pathname + window.location.search');
    assert.equal(guardedUrl, '/login?returnUrl=%2Fpersonal');
    results.push('PASS 2/8: Activación opt-in en RAM y protección de rutas iamAuthGuard -> /login?returnUrl=%2Fpersonal');

    // 3. Login -> /auth/me -> selección de contexto autorizado
    await cdp.setInputValue('[data-testid="input-identificador"]', 'jefa_turno_qa');
    await cdp.setInputValue('[data-testid="input-password"]', 'demo-pass-123');
    await cdp.click('[data-testid="btn-submit-login"]');
    // Como había returnUrl=/personal, navega automáticamente a /personal tras login!
    await cdp.waitForSelector('[data-testid="personnel-v1-projection-notice"]');
    await cdp.waitForSelector(`[data-testid="personnel-row-${MOCK_IDS.empleadoId}"]`);
    const personalText = await cdp.evalJs('document.body.innerText');
    assert.ok(personalText.includes('Sofía Ramírez'), 'Debe renderizar padrón real mockeado');
    assert.ok(!personalText.includes(MOCK_IDS.accessToken), 'Jamás exponer accessToken en DOM');
    results.push('PASS 3/8: Login -> /auth/me -> redirección returnUrl=/personal con contexto autorizado');

    // 4. Personal -> Detalle de empleado -> Adscripciones por contrato
    await cdp.click(`[data-testid="personnel-row-${MOCK_IDS.empleadoId}"]`);
    await cdp.waitForSelector('[data-testid="openapi-employee-summary"]');
    await cdp.click(`[data-testid="btn-load-contract-${MOCK_IDS.contratoId}"]`);
    await cdp.waitForSelector('[data-testid="contract-assignments-list"]');
    const assignText = await cdp.evalJs(
      'document.querySelector(\'[data-testid="contract-assignments-list"]\').innerText',
    );
    assert.ok(assignText.includes(MOCK_IDS.adscripcionId));
    await cdp.screenshot('f4e1-personal-openapi-desktop.png', 1440, 1100);
    results.push('PASS 4/8: Recorrido Padrón -> Detalle de empleado -> Adscripciones por contrato');

    // 5. Verificar pantalla /login autenticada (contexto autorizado y captura)
    await cdp.click('[data-testid="nav-iam-login"]');
    await cdp.waitForSelector('[data-testid="authenticated-session-card"]');
    await cdp.waitForSelector('[data-testid="select-authorized-hospital"]');
    await cdp.screenshot('f4e1-login-authenticated-desktop.png', 1440, 1100);
    results.push('PASS 5/8: Sesión IAM V2 autenticada y selector de ámbito hospital/servicio visible');

    // 6. Programación (GET /api/v1/programaciones)
    await cdp.click('[data-testid="nav-programacion"]');
    await cdp.waitForSelector('[data-testid="openapi-scheduling-table"]');
    await cdp.waitForSelector('[data-testid="scheduling-coverage-unavailable-notice"]');
    const hasSyntheticAlerts = await cdp.evalJs(
      'Boolean(document.querySelector(\'[data-testid="scheduling-alerts-section"]\'))',
    );
    assert.equal(hasSyntheticAlerts, false, 'No deben mezclarse alertas sintéticas en modo API');
    await cdp.screenshot('f4e1-programacion-openapi-desktop.png', 1440, 1100);
    results.push('PASS 6/8: Programación OpenAPI v1 sin mezclar alertas sintéticas');

    // 7. Tablero de Coordinación (PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA) en escritorio y móvil
    await cdp.click('[data-testid="nav-dashboard"]');
    await cdp.waitForSelector('[data-testid="coordination-programming-panel"]');
    await cdp.waitForSelector('[data-testid="dashboard-semantic-disclaimer"]');
    await cdp.waitForSelector('[data-testid="unavailable-attendance"]');
    await cdp.waitForSelector('[data-testid="unavailable-coverage"]');
    await cdp.waitForSelector('[data-testid="unavailable-incidents"]');
    const dashChecks = await cdp.evalJs(`({
      disclaimer: document.querySelector('[data-testid="dashboard-semantic-disclaimer"]').innerText,
      jornadas: document.querySelector('[data-testid="metric-jornadas"]').innerText,
      hasSyntheticKpis: Boolean(document.querySelector('[data-testid="kpi-cards-grid"]')),
      sidebarText: document.querySelector('[data-testid="sidebar-context-card"]').innerText,
    })`);
    assert.ok(dashChecks.disclaimer.includes('PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA'));
    assert.ok(dashChecks.jornadas.includes('42'));
    assert.equal(dashChecks.hasSyntheticKpis, false, 'No deben mostrarse KPIs sintéticos en modo API');
    assert.ok(!dashChecks.sidebarText.includes('Hospital Modelo Sintético'));
    await cdp.screenshot('f4e1-dashboard-openapi-desktop.png', 1440, 1100);
    await cdp.screenshot('f4e1-dashboard-openapi-mobile.png', 390, 960);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    results.push('PASS 7/8: Tablero Coordinación con semántica PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA (desktop + mobile)');

    // 8. Logout desde encabezado -> limpieza total -> restauración segura a SYNTHETIC_DEMO
    await cdp.click('[data-testid="btn-header-logout"]');
    await cdp.waitForSelector('[data-testid="login-form-card"]');
    const storageCheckEnd = await cdp.evalJs(
      '({ ls: window.localStorage.length, ss: window.sessionStorage.length })',
    );
    assert.equal(storageCheckEnd.ls, 0);
    assert.equal(storageCheckEnd.ss, 0);
    await cdp.click('[data-testid="btn-restore-synthetic-demo"]');
    await cdp.click('[data-testid="nav-dashboard"]');
    await cdp.waitForSelector('[data-testid="synthetic-demo-banner"]');
    results.push('PASS 8/8: Logout, limpieza RAM/WebStorage y restauración a SYNTHETIC_DEMO');

    console.log('\n=== PRUEBAS E2E DE INTERFAZ CON MOCKS CONTRACTUALES (NO POSTGRESQL QA) ===');
    for (const line of results) console.log(line);
    console.log(`Total solicitudes HTTP contractuales interceptadas: ${recordedApiCalls.length}`);
    console.log('ESTADO FINAL E2E UI-MOCK: PASS\n');
  } finally {
    browser.ws.close();
    browser.child.kill('SIGTERM');
    fs.rmSync(browser.profileDir, { recursive: true, force: true });
    server.close();
  }
}

run().catch((err) => {
  console.error('FAIL E2E UI-MOCK:', err);
  process.exit(1);
});
