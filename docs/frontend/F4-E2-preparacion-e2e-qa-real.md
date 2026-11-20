# SIGE-H — Preparación F4-E2 / F4-E2B: Prueba E2E Real contra Angular + NestJS + PostgreSQL QA

**Última actualización:** 2026-11-19 (extensión **F4-E2B** con `GET /api/v1/pases-lista`)  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Estado:** **PREPARADO — DETENIDO EN ESPERA DE INSTANCIA QA SINTÉTICA AUTORIZADA (Codex)**

---

## 1. Script E2E Real Entregado

- **Archivo:** `e2e/sigeh-real-qa-e2e.mjs`
- **Comando npm:** `npm run e2e:real-qa`
- **Tipo de ejecución registrado en reporte:** `executionKind: "REAL_QA_E2E_NO_MOCKS"`
- **Evidencia sanitizada que genera:** `docs/frontend/evidence/f4e2-real-qa-report.json` + capturas `docs/frontend/screenshots/f4e2-real-*.png`

### Distinción Explícita: F4-E1 (`e2e:mock`) vs. F4-E2 (`e2e:real-qa`)

| Aspecto | F4-E1 (`npm run e2e:mock`) | F4-E2 (`npm run e2e:real-qa`) |
| :--- | :--- | :--- |
| **Servidor HTTP de prueba** | Servidor estático + mocks contractuales integrados en el propio script | **Cero mocks** — conecta al dev-server real de Angular (`http://127.0.0.1:4200`) y proxy `proxy.conf.json` → NestJS (`http://127.0.0.1:3000`) |
| **Intercepción de endpoints** | Sí (respuestas simuladas en `/api/v1/*`) | **No** (solo observación pasiva CDP `Network.*` para bitácora sanitizada) |
| **Pre-flight de base de datos** | No requiere PostgreSQL | **Obligatorio:** exige `GET /api/v1/health/ready` HTTP `200` con `database.status === "up"` y `schemaVerified === true` |
| **Credenciales** | Ficticias embebidas en mock | Variables de entorno sintéticas (`SIGEH_QA_IDENTIFICADOR`, `SIGEH_QA_PASSWORD`) sin persistencia ni impresión en logs |
| **Etiqueta de reporte** | `PRUEBAS E2E DE INTERFAZ CON MOCKS CONTRACTUALES` | `REAL_QA_E2E_NO_MOCKS` en `docs/frontend/evidence/f4e2-real-qa-report.json` |

---

## 2. Precondiciones y Dependencias

### Dependencias en `SIGE-H-Frontend` (ya verificadas)
- Node.js `v26+` (con `fetch` y `WebSocket` nativos)
- Chromium headless disponible en `/usr/bin/chromium`
- Contrato sincronizado `contracts/sigeh-v1.json` (21 operaciones) con SHA-256 `ab9dd2a4b17806784c029ca16b79a4837542f83ac3ea3a0246cb6b50a18847f0` (respaldo 19 ops en `contracts/sigeh-v1.19ops.bak.json`)
- Proxy local de mismo origen configurado en `proxy.conf.json` (`/api` → `http://127.0.0.1:3000`, sin CORS abierto)

### Precondiciones Operativas (Externas — Codex / QA)
1. **PostgreSQL QA sintético activo** (sin datos institucionales reales) con esquema `sigeh` verificado y privilegios `SELECT` por columna vigentes.
2. **Instancia temporal NestJS QA escuchando en `http://127.0.0.1:3000`** con `IAM_V2_ENABLED=true`, `L3A_READS_ENABLED=true` y el módulo de **Asistencia (`CU-ASI-01/02`) habilitado** para `GET /api/v1/pases-lista` (manteniendo deshabilitados por defecto fuera de esta ventana QA).
3. **Usuario QA sintético activo** con credenciales temporales (`SIGEH_QA_IDENTIFICADOR` / `SIGEH_QA_PASSWORD`), facultades de lectura L3B-2A **y facultad de lectura explícita de pases de lista** (sin asumir que `ASISTENCIA_CAPTURAR` autoriza lectura), más al menos una asignación `(hospitalId, servicioId)` en `/api/v1/auth/me` (idealmente `>= 2` servicios y/o `>= 2` hospitales autorizados para validar el cambio y limpieza de ámbito en `/personal` y `/pases-lista`).
4. **Datos sintéticos vigentes y fixtures de asistencia (solo lectura):**
   - Padrón y adscripciones vigentes para `SIGEH_QA_FECHA`.
   - Programaciones vigentes dentro de `SIGEH_QA_DESDE` → `SIGEH_QA_HASTA` (`<= 168 h`).
   - Para `/pases-lista`: zona horaria configurada en el hospital QA, jornadas programadas en la fecha local `SIGEH_QA_FECHA` y registros sintéticos preexistentes de asistencia (`PRESENTE` / `AUSENTE` / `PARCIAL`) con `ultimaCaptura` (`actorId`, `registradoEn`, `eventoId`) generados por el entorno QA — **Angular nunca emite `PUT .../asistencia` durante F4-E2B**.

---

## 3. Comandos de Ejecución (Ejecutar Únicamente Cuando Codex Confirme QA Activo)

### Terminal 1 — Servidor de desarrollo Angular (mismo origen con proxy `/api`)
```bash
cd /home/robreport/Documents/SIGE-H-Frontend
npm start
# Escucha en http://127.0.0.1:4200 y reenvía /api -> http://127.0.0.1:3000
```

### Terminal 2 — Ejecución de la Prueba E2E Real contra QA
```bash
cd /home/robreport/Documents/SIGE-H-Frontend
SIGEH_QA_IDENTIFICADOR="<usuario_sintetico_qa>" \
SIGEH_QA_PASSWORD="<password_sintetico_qa>" \
SIGEH_QA_FECHA="2026-11-18" \
SIGEH_QA_TEST_401="1" \
npm run e2e:real-qa
```

*(Opcionales si los fixtures sintéticos de QA están en una semana o turno específico: `SIGEH_QA_DESDE="2026-11-16T00:00:00-06:00"`, `SIGEH_QA_HASTA="2026-11-23T00:00:00-06:00"` y `SIGEH_QA_HORARIO_ID="<uuid_horario>"`).*

---

## 4. Criterios Verificables de Aceptación (PASS / FAIL — 11 Pasos F4-E2B)

### Criterios para declarar **PASS**
1. **Pre-flight real:** `GET /api/v1/health/ready` (`200`, `database.status = "up"`, `schemaVerified = true`), `GET /api/v1/meta/version` (`200`, `apiBasePath = "/api/v1"`) y SHA-256 `ab9dd2a4b17806784c029ca16b79a4837542f83ac3ea3a0246cb6b50a18847f0` verificados.
2. **Arranque seguro por defecto:** `/dashboard` carga en `SYNTHETIC_DEMO` con `iamEnabled = false`, `0` llamadas `/api/v1/*` y `0` entradas en `localStorage`/`sessionStorage`.
3. **Protección de rutas IAM:** tras activar Integración QA en RAM, navegar a `/personal` sin sesión redirige a `/login?returnUrl=%2Fpersonal`.
4. **Autenticación y contexto real:** `POST /api/v1/auth/login` (`200`) + `GET /api/v1/auth/me` (`200`), selector de hospital/servicio derivado de `/auth/me`, cero tokens en DOM y cero entradas en Web Storage.
5. **Módulos L3B-2A + CU-ASI-01/02 (solo lectura) reales:**
   - `GET /api/v1/empleados` (`200`, sin RUD ni KPIs sintéticos), `GET /api/v1/empleados/{empleadoId}` (`200`) y `GET /api/v1/contratos/{contratoId}/adscripciones` (`200`).
   - Cambio entre ámbitos autorizados elimina detalle/adscripciones previas sin exposición residual.
   - `GET /api/v1/programaciones` (`200`, ventana `<= 168 h`, sin alertas sintéticas).
   - `GET /api/v1/tableros/coordinacion` (`200`, semántica `PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA`, bloques no disponibles sin relleno sintético).
   - **Paso 9/11 (`/pases-lista`):** `GET /api/v1/pases-lista` (`200`, cero escrituras `PUT .../asistencia`), muestra estado operativo (`PRESENTE`/`AUSENTE`/`PARCIAL`/`PENDIENTE`/`NO_EXIGIBLE`), `fecha`, `zonaHoraria`, ámbito, trazabilidad (`actorId`, `registradoEn`, `eventoId` BIGINT string), separación explícita respecto de programación/cobertura/incidencias y limpieza al cambiar de servicio autorizado, hospital autorizado o al cerrar sesión.
6. **Sesiones, rotación y limpieza real:** `GET /api/v1/auth/sessions` (`200`), rotación real `POST /api/v1/auth/refresh` (`200`, `refreshToken` nuevo distinto al anterior + `GET /api/v1/auth/me` `200`), y `POST /api/v1/auth/logout` (`204`) dejando `localStorage`, `sessionStorage`, tabla de pases de lista y memoria RAM limpios.
7. **Evidencia sanitizada:** `docs/frontend/evidence/f4e2-real-qa-report.json` generado con `overallStatus: "PASS"`, `executionKind: "REAL_QA_E2E_NO_MOCKS"`, capturas `f4e2-real-*.png` (incluyendo `f4e2-real-pases-lista-desktop.png` y `f4e2-real-pases-lista-mobile.png`) y **cero** contraseñas o tokens almacenados.

### Condiciones de **FAIL / BLOCKED**
- Fallo de conectividad en `/api/v1/health/ready` o `503` (módulo IAM/L3A apagado o PostgreSQL QA inaccesible).
- Cualquier aparición de tokens o contraseñas en DOM, `localStorage`, `sessionStorage` o `f4e2-real-qa-report.json`.
- Mezcla de indicadores sintéticos con datos reales o ausencia de aviso `PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA`.
- Exposición residual de detalle/adscripciones o filas de `/pases-lista` al cambiar de hospital, cambiar de servicio o tras `403`/`logout`.
