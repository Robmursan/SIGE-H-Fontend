# SIGE-H — AGY F4-F: Consulta de Pases de Lista en Coordinación Angular (CU-ASI-01/02)

**Fecha:** 2026-11-19  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Fase:** `F4-F` (Sincronización OpenAPI 21 operaciones + consulta de solo lectura `GET /api/v1/pases-lista`)  
**Estado:** **PASS**

> **Aclaración de alcance:** Esta entrega integra y valida mediante pruebas unitarias/contractuales (`HttpTestingController`) la consulta de solo lectura `GET /api/v1/pases-lista`. **No constituye validación E2E contra QA real de PostgreSQL** (pendiente de ejecución controlada en F4-E2 cuando se levante la instancia QA sintética).

---

## 1. Validación del Contrato OpenAPI Actualizado (21 Operaciones)

- **Archivo activo:** `contracts/sigeh-v1.json` (`77,093 bytes`)
- **Respaldo versión anterior (19 operaciones):** `contracts/sigeh-v1.19ops.bak.json` (`SHA-256: 315c958c5d46fbdf7e6bee830d207be71b1ca0d137b74be456c300e4f05b4fdc`)
- **SHA-256 verificado del contrato actual:** `ab9dd2a4b17806784c029ca16b79a4837542f83ac3ea3a0246cb6b50a18847f0`
- **Validación determinista (`npm run validate:openapi`):** **PASS**
  - Exactamente **`21` operaciones** / **`21` `operationId` únicos** (`0` duplicados).
  - **`97` referencias internas `$ref`** resueltas (`0` rotas).
  - Operaciones nuevas verificadas:
    - `GET /api/v1/pases-lista` (`operationId: listScopedAttendanceRoster`) — **integrada en solo lectura en Coordinación Angular**.
    - `PUT /api/v1/programaciones/{programacionId}/asistencia` (`operationId: captureInitialAttendance`) — presente en contrato (captura móvil; **no implementada en Coordinación Angular**).

### Revisión de Facultades Reales
- `PUT /api/v1/programaciones/{programacionId}/asistencia` exige `ASISTENCIA_CAPTURAR`.
- En `GET /api/v1/pases-lista`, `PaseListaItemDto.motivoNoCapturable` incluye explícitamente el valor `SIN_FACULTAD_CAPTURA`, confirmando que **un usuario autorizado para consultar pases de lista puede carecer de `ASISTENCIA_CAPTURAR`**, y que **`ASISTENCIA_CAPTURAR` no implica autorización de lectura**.
- Por lo tanto, `AttendanceRosterHttpService` **jamás condiciona la lectura en cliente a `ASISTENCIA_CAPTURAR`**; delega la evaluación de facultades de lectura y ámbito multihospital exclusivamente en NestJS.

---

## 2. Componentes, Servicios y DTOs Implementados

1. **DTOs exactos y mappers (`src/app/core/contracts/openapi-dtos.contract.ts`):**
   - `AttendanceEmployeeDto`, `LastCaptureDto`, `PaseListaItemDto`, `PaseListaPageDto`, `ScopedAttendanceRosterQueryParams`.
   - `mapPaseListaItemDtoToDomain` y `mapPaseListaPageDtoToSnapshot`: preservan estrictamente `eventoId` y `revision` como **`string` decimales (`BIGINT`, nunca `Number`)**.
2. **Modelos y puerto desacoplado:**
   - `src/app/core/models/attendance-roster.model.ts`
   - `src/app/core/ports/attendance-roster.gateway.ts` (`ATTENDANCE_ROSTER_GATEWAY`)
3. **Adaptador HTTP real (`src/app/core/http/attendance-roster-http.service.ts`):**
   - Consume `GET /api/v1/pases-lista` con los parámetros exactos del contrato: `hospitalId*` (UUID), `servicioId*` (UUID), `fecha*` (`YYYY-MM-DD`, fecha local del hospital), `horarioId` (UUID opcional), `cursor` (UUID opcional) y `limit` (`1..100`).
   - Consume el contexto autorizado desde `AuthSessionService` y maneja uniformemente `400`, `401`, `403` (`state: 'forbidden'`), `404` y `503`.
4. **Adaptador sintético seguro (`src/app/core/adapters/synthetic-attendance-roster.adapter.ts`) + Proxy configurable (`GatewaySelectorService`):**
   - Conserva **`SYNTHETIC_DEMO` como modo predeterminado** (`iamEnabled = false`), sin simular respuestas reales del backend.
5. **Vista de Coordinación (`src/app/features/attendance-roster/`, ruta `/pases-lista` protegida por `iamAuthGuard`):**
   - Muestra estado operativo (`PRESENTE`, `AUSENTE`, `PARCIAL`, `PENDIENTE`, `NO_EXIGIBLE`), `validacionAdministrativa` (`PENDIENTE`, `VALIDADA`, `OBSERVADA`), `revision`, trazabilidad de captura (`registradoEn`, `actorId`, `eventoId`), zona horaria (`zonaHoraria`) y ámbito (`hospitalId` / `servicioId`).
   - Banner semántico obligatorio que diferencia explícitamente la **asistencia operativa registrada** de **programación**, **cobertura efectiva** e **incidencia administrativa**.
   - Cancela solicitudes pendientes (`takeUntil(cancelRoster$)`) y limpia resultados al cambiar filtros, hospital, servicio, usuario o cerrar sesión.
   - En `/dashboard` (modo real), el bloque de asistencia agregada mantiene el estado *No disponible en este tablero* y ofrece un enlace separado hacia `/pases-lista` sin mezclar indicadores.

---

## 3. Verificación Ejecutada

| Comprobación | Comando | Resultado |
| :--- | :--- | :--- |
| Validación OpenAPI (21 ops + SHA-256) | `npm run validate:openapi` | **PASS** (`21` ops, `97` `$ref` OK) |
| TypeScript App y Spec | `npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json` | **PASS** (`0` errores) |
| Build producción Angular | `npm run build` | **PASS** (`0` errores, `0` warnings) |
| Suite unitaria y contractual | `npx ng test --watch=false` | **PASS** (**26 suites / 83 pruebas aprobadas**) |
| Regresión E2E de interfaz con mocks | `npm run e2e:mock` | **PASS** (**8/8 pasos aprobados**) |

---

## 4. Limitaciones y Condiciones Pendientes para Demostración Completa contra QA Real

1. **Metadatos `x-sigeh-status` en `sigeh-v1.json`:** en el archivo transferido, las extensiones de `GET /api/v1/pases-lista` todavía conservan las cadenas `local-mock-tested-disabled-awaiting-ephemeral-validation` / `not-authorized-awaiting-ephemeral-package` y `ASISTENCIA` permanece deshabilitado por defecto (`HTTP 503`).
2. **Sin nombres descriptivos de hospital/servicio/actor:** `hospitalId`, `servicioId` y `ultimaCaptura.actorId` se muestran por identificador UUID porque `descriptive organization fields` continúa en `x-sigeh-pending-resources`.
3. **Condiciones para validación E2E real (F4-E2):**
   - Instancia temporal NestJS QA en `http://127.0.0.1:3000` con `IAM_V2_ENABLED=true`, `L3A_READS_ENABLED=true` y módulo `ASISTENCIA` habilitado.
   - Credenciales QA sintéticas con facultad de lectura de pases de lista y asignaciones explícitas `(hospitalId, servicioId)` en `/api/v1/auth/me`.
   - Ejecución de Angular vía `npm start` sobre el proxy `/api` en mismo origen.
