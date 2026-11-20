# SIGE-H — AGY F4-E1: Preparación de Demostración Ejecutiva y Pruebas E2E de Interfaz con Mocks

**Fecha:** 2026-11-18  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Fase:** `F4-E1` (Recorrido ejecutivo del 22 de noviembre de 2026 + pruebas E2E de navegador con mocks contractuales)  
**Estado:** **PASS**

> **Etiqueta de alcance E2E:** Las pruebas de navegador automatizadas de esta entrega (`e2e/sigeh-ui-mock-e2e.mjs`) son **pruebas E2E de interfaz con mocks contractuales** ejecutadas en Chromium headless contra el bundle de producción compilado. **No sustituyen ni constituyen la validación E2E contra NestJS y PostgreSQL QA real (reservada para F4-E2).**

---

## 1. Mejoras de UX y Mecanismo Seguro de Activación QA Implementados

1. **Activación explícita y volátil de Integración QA (solo memoria RAM)** en `src/app/features/auth-login/auth-login.component.ts` y `.html`:
   - `DEFAULT_SIGEH_RUNTIME_CONFIG` conserva **`dataSourceMode: 'SYNTHETIC_DEMO'`** e **`iamEnabled: false`** por defecto.
   - Panel **Control Explícito de Sesión QA (Solo en Memoria RAM)** en `/login` con dos acciones:
     - **Activar Integración QA (IAM + API v1):** activa en memoria `iamEnabled = true` y conmuta globalmente los módulos a `OPENAPI_HTTP_READY` sin escribir nada en `localStorage`, `sessionStorage` ni cookies (al recargar el navegador regresa automáticamente al modo seguro).
     - **Restaurar Modo Demo Seguro:** limpia toda la sesión en memoria RAM, desactiva `iamEnabled` y regresa todos los módulos a `SYNTHETIC_DEMO`.
   - Enlaces directos de recorrido tras autenticarse (`/personal`, `/programacion`, `/dashboard`).
2. **Separación visual estricta entre Demo Sintético e Integración API** en `src/app/layout/shell/institutional-shell.component.ts` y `.html`:
   - Tarjeta lateral, etiqueta superior y pie de página reflejan con claridad el origen activo (`MODO DEMO SINTÉTICO` vs. `INTEGRACIÓN QA (OPT-IN)` / `SESIÓN IAM V2 (RAM)`), mostrando el contexto autorizado (`Hospital UUID` + `Servicio UUID`) y botón directo **Cerrar sesión** en el encabezado sin mezclar textos de `Hospital Modelo Sintético` en modo API.
3. **Ergonomía de filtros ISO-8601 (168 h)** en `WorkSchedulingComponent`, `ExecutiveDashboardComponent`, `openapi-dtos.contract.ts` (`buildLocalHoursWindow`) y `src/styles/_components.scss`:
   - Presets rápidos de ventana (`24 h` y `168 h` con offset local ISO-8601), indicador visible de horas calculadas (`Ventana válida: 168 h / máx. 168 h`) y corrección de desbordamiento en selectores de UUID largos detectada en la inspección visual.

---

## 2. Recorrido Demostrativo y Pruebas Automatizadas de Navegador (Mocks Contractuales)

Archivo de pruebas: `e2e/sigeh-ui-mock-e2e.mjs` (ejecutable mediante `npm run e2e:mock` usando Chromium headless + DevTools Protocol sobre el bundle `dist/SIGE-H-Frontend/browser`):

1. **PASS 1/8:** Arranque seguro en `SYNTHETIC_DEMO` (`iamEnabled = false`, `0` llamadas `/api/v1/*`, `localStorage = 0`, `sessionStorage = 0`).
2. **PASS 2/8:** Activación explícita QA en RAM (`/login`) y redirección de `iamAuthGuard` al intentar abrir `/personal` sin sesión (`/login?returnUrl=%2Fpersonal`).
3. **PASS 3/8:** `POST /api/v1/auth/login` → `GET /api/v1/auth/me` → redirección automática a `/personal` con contexto autorizado y cero tokens expuestos en DOM.
4. **PASS 4/8:** Padrón (`GET /api/v1/empleados`, sin RUD ni KPIs sintéticos) → Detalle (`GET /api/v1/empleados/{empleadoId}`) → Adscripciones por contrato (`GET /api/v1/contratos/{contratoId}/adscripciones`).
5. **PASS 5/8:** Vista `/login` autenticada con selector de hospital/servicio derivado de `/auth/me`.
6. **PASS 6/8:** Programación (`GET /api/v1/programaciones`) con aviso de alertas de cobertura no disponibles y cero alertas sintéticas mezcladas.
7. **PASS 7/8:** Tablero de Coordinación (`GET /api/v1/tableros/coordinacion`) con banner `PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA`, las 7 métricas reales de programación y bloques explícitos de *No disponible en modo real* para asistencia, cobertura e incidencias (verificado en escritorio `1440px` y móvil `390px`).
8. **PASS 8/8:** Logout (`POST /api/v1/auth/logout`), limpieza total de memoria RAM/WebStorage y retorno seguro a `SYNTHETIC_DEMO`.

---

## 3. Capturas Generadas y Guion de Presentación

- **Guion y lista de comprobación:** `docs/frontend/GUION-DEMO-EJECUTIVA-22NOV.md`
- **Capturas de validación visual F4-E1:**
  - `docs/frontend/screenshots/f4e1-dashboard-synthetic-desktop.png`
  - `docs/frontend/screenshots/f4e1-login-authenticated-desktop.png`
  - `docs/frontend/screenshots/f4e1-personal-openapi-desktop.png`
  - `docs/frontend/screenshots/f4e1-programacion-openapi-desktop.png`
  - `docs/frontend/screenshots/f4e1-dashboard-openapi-desktop.png`
  - `docs/frontend/screenshots/f4e1-dashboard-openapi-mobile.png`

---

## 4. Resultados de Verificación Ejecutada

| Comprobación | Comando | Resultado |
| :--- | :--- | :--- |
| Validación OpenAPI y SHA-256 | `npm run validate:openapi` | **PASS** (`19` ops, `0` `$ref` rotos, SHA-256 exacto) |
| TypeScript App y Spec | `npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json` | **PASS** (`0` errores) |
| Build producción Angular | `npm run build` | **PASS** (`0` errores, `0` warnings) |
| Suite unitaria y contractual | `npx ng test --watch=false` | **PASS** (**24 suites / 78 pruebas aprobadas**) |
| Pruebas E2E de interfaz con mocks (Chromium) | `npm run e2e:mock` | **PASS** (**8/8 pasos aprobados**, `11` solicitudes contractuales) |

---

## 5. Lista Exacta de Pendientes para Ejecutar F4-E2 contra QA Real (PostgreSQL + NestJS)

1. **Autorización operativa para levantar instancia temporal QA de NestJS** en `http://127.0.0.1:3000` con `IAM_V2_ENABLED=true`, `ORG_ENABLED=true` (si se prueba Organización) y `L3A_READS_ENABLED=true`.
2. **Provisión temporal de credenciales QA sintéticas** en PostgreSQL QA con al menos dos asignaciones explícitas `(hospitalId, servicioId)` en `/api/v1/auth/me` (y un usuario restringido para verificar aislamiento multihospital `403` / `404` real).
3. **Ejecución del servidor de desarrollo Angular con proxy mismo origen:** `npm start` (`proxy.conf.json` enrutando `/api` → `http://127.0.0.1:3000` sin CORS abierto).
4. **Ejecución de pruebas E2E reales (F4-E2)** contra el backend vivo comprobando:
   - `POST /api/v1/auth/login` + `GET /api/v1/auth/me` + `POST /api/v1/auth/refresh` (rotación real y no-replay) + `GET /api/v1/auth/sessions` + `POST /api/v1/auth/logout`.
   - `GET /api/v1/empleados`, `GET /api/v1/empleados/{empleadoId}`, `GET /api/v1/contratos/{contratoId}/adscripciones`, `GET /api/v1/programaciones` y `GET /api/v1/tableros/coordinacion` con datos QA sintéticos.
   - Evidencia real de errores `400`, `401`, `403`, `404`, `429` (rate limit IAM) y `503` (al apagar flags).
5. **Limpieza post-QA:** revocación/eliminación de credenciales sintéticas QA y apagado de la instancia temporal dejando IAM y lecturas L3A deshabilitados por defecto.
