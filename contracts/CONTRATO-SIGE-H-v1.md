# Contrato v1 para AGY / Android

Artefacto: `artifacts/openapi/sigeh-v1.json`. Generación sin PostgreSQL, después del build:

```bash
cd apps/api
npm run build
node scripts/export-openapi.mjs
```

El exportador usa un Pool prohibido, no inicia servidor y valida referencias internas y operationId únicos. Dos exportaciones consecutivas deben tener SHA-256 idéntico. Las extensiones `x-sigeh-status`, `x-sigeh-projection`, `x-sigeh-deployment` y `x-sigeh-pending-resources` distinguen pruebas realizadas, proyección limitada y pendientes. No hay rutas simuladas de personal/programación en `paths`.

## Autenticación y errores

Todas las rutas REST están bajo `/api/v1`. IAM y ORG siguen deshabilitados por defecto; requieren una instancia QA temporal autorizada. Esta entrega no deja un servicio escuchando ni credenciales de demostración persistentes. Health/live/ready y meta/version conservan contrato; Swagger es `/docs` cuando se configure una instancia autorizada.

- `POST /auth/login`: JSON identificador/password; 200 con accessToken, refreshToken, tokenType, expiresIn y sessionId.
- Enviar `Authorization: Bearer <accessToken>` en perfil, logout, sesiones y ORG. Usar expiresIn de la respuesta; no asumir una duración fija.
- `POST /auth/refresh`: JSON refreshToken; 200 entrega un reemplazo de un solo uso. El cliente debe coordinar una única renovación concurrente: el replay revoca la familia y sus access tokens.
- `GET /auth/me`: perfil y facultades de la sesión propia. No proporciona autoridad offline ni sustituye la validación del servidor.
- `GET /auth/sessions`, `DELETE /auth/sessions/{sessionId}` y `POST /auth/logout`; revocaciones correctas devuelven 204 sin cuerpo. Sesión ajena: 404.
- Errores Nest: statusCode, message (string o array de validación), error. 400 entrada inválida; 401 credencial/sesión inválida; 403 facultad/ámbito insuficiente; 404 sesión no disponible; 429 límite de intentos; 503 IAM deshabilitado/persistencia no disponible. No interpretar un 503 como permiso concedido ni activar bypass cliente.

No registrar ni incluir contraseñas/tokens en URLs, analytics o reportes. No hay cookies de refresh implementadas ni autorización offline. Transporte, custodia segura de tokens y origen/proxy del frontend deben acordarse en la fase de integración; este sprint no configura CORS abierto ni accede al workspace de AGY.

## Organización implementada con proyección limitada

| Ruta GET | Filtros |
|---|---|
| `/hospitales` | hospitalId opcional |
| `/hospitales/{hospitalId}/divisiones` | divisionId opcional |
| `/servicios` | hospitalId obligatorio; divisionId/servicioId opcionales |

Las tres admiten cursor UUID exclusivo y limit entero 1–100, por defecto 50. Orden fijo `id:asc`. Respuesta: `{ items, nextCursor, limit, order }`; nextCursor=null termina la paginación. Mantener filtros iguales entre páginas. Campos desconocidos o inconsistentes se rechazan con 400.

Cada item expone **solo id, hospitalId, divisionId, servicioId y activo**. Los IDs padre no aplicables son null. **Nombre, clave y zonaHoraria no están incluidos**: faltan sus privilegios SQL; no generar nombres ficticios para producción. La facultad conservadora existente es CATALOGOS_ADMINISTRAR, con mandatos y alcance persistidos; el nombre de un rol no implica permiso. El servidor filtra resultados y audita decisiones; no confiar en filtrar hospitales en el cliente.

## Pendientes que impiden el flujo hospitalario completo

Personal/adscripciones, programación, dashboard operativo, incidencias, necesidades de cobertura y disponibilidad eventual no son endpoints operativos de esta entrega. Requieren permisos SQL por objeto/columna y ratificar facultades de consulta; incidencias además requieren reglas de escritura y trazabilidad. No simular cobertura efectiva a partir de programación ni tratar disponibilidad declarada como incorporación confirmada.

## Actualización Contractual F4-F (CU-ASI-01/02 — 21 Operaciones)

- **Artefacto sincronizado:** `contracts/sigeh-v1.json` (respaldo anterior conservado en `contracts/sigeh-v1.19ops.bak.json`)
- **SHA-256 verificado:** `ab9dd2a4b17806784c029ca16b79a4837542f83ac3ea3a0246cb6b50a18847f0`
- **Cobertura validada:** `21` operaciones (`21` `operationId` únicos), `97` referencias `$ref` resueltas (`0` rotas).
- **Operaciones CU-ASI-01/02 incorporadas:**
  - `GET /api/v1/pases-lista` (`listScopedAttendanceRoster`) — consulta de jornadas y asistencia operativa por fecha local (`hospitalId*`, `servicioId*`, `fecha*`, `horarioId`, `cursor`, `limit`). Respuesta: `PaseListaPageDto` (`hospitalId`, `servicioId`, `fecha`, `zonaHoraria`, `items: PaseListaItemDto[]`, `nextCursor`, `limit`, `order: 'id:asc'`). **Integrado en solo lectura en Angular Coordinación (F4-F).**
  - `PUT /api/v1/programaciones/{programacionId}/asistencia` (`captureInitialAttendance`) — primera captura online con `Idempotency-Key` y facultad `ASISTENCIA_CAPTURAR` (reservado para captura móvil; **no implementado en Angular Coordinación**).
- **Facultades y separación semántica:**
  - `ASISTENCIA_CAPTURAR` no autoriza lectura; NestJS valida la facultad de lectura y el ámbito hospital/servicio de `GET /api/v1/pases-lista` (el campo `motivoNoCapturable: "SIN_FACULTAD_CAPTURA"` confirma que un lector puede carecer de facultad de captura).
  - La asistencia capturada (`PRESENTE`, `AUSENTE`, `PARCIAL`, `PENDIENTE`, `NO_EXIGIBLE`) se mantiene estrictamente separada de programación, cobertura efectiva e incidencias administrativas (`validacionAdministrativa: PENDIENTE | VALIDADA | OBSERVADA`, sin clasificación de incidencias).

---

## Actualización Contractual F4-A (IAM/ORG + L3B-2A — Verificado por AGY 2)

- **Artefacto sincronizado:** `contracts/sigeh-v1.json`
- **SHA-256 verificado:** `315c958c5d46fbdf7e6bee830d207be71b1ca0d137b74be456c300e4f05b4fdc`
- **Cobertura validada:** `19` rutas / `19` operaciones (`operationId` únicos), `80` referencias `$ref` resueltas (`0` rotas), `23` esquemas en `components.schemas`.
- **Operaciones L3B-2A incorporadas (`x-sigeh-status: "qa-tested-disabled-by-default"`):**
  - `GET /api/v1/empleados` (`listScopedStaff`) — query obligatorios: `hospitalId`, `servicioId`, `fecha`; opcionales: `divisionId`, `cursor`, `limit`. Respuesta: `EmployeePageDto` (`EmployeeReadDto`: `empleadoId`, `nombres`, `primerApellido`, `activo`).
  - `GET /api/v1/empleados/{empleadoId}` (`getScopedEmployee`) — path: `empleadoId`; query obligatorios: `hospitalId`, `servicioId`, `fecha`. Respuesta: `EmployeeDetailDto` (`empleado`, `adscripciones`).
  - `GET /api/v1/contratos/{contratoId}/adscripciones` (`listScopedAssignments`) — path: `contratoId`; query obligatorios: `hospitalId`, `servicioId`, `fecha`. Respuesta: `AssignmentPageDto` (`AssignmentReadDto`: `adscripcionId`, `contratoId`, `servicioId`, `clase`, `inicio`, `fin`).
  - `GET /api/v1/programaciones` (`listScopedWeeklyProgramming`) — query obligatorios: `hospitalId`, `servicioId`, `desde`, `hasta`; opcionales: `divisionId`, `cursor`, `limit`. Respuesta: `SchedulePageDto` (`ScheduleReadDto`).
  - `GET /api/v1/tableros/coordinacion` (`getScopedProgrammingIndicators`) — query obligatorios: `hospitalId`, `servicioId`, `desde`, `hasta`; opcional: `divisionId`. Respuesta: `ProgrammingDashboardDto` (`base`, `jornadas`, `empleadosProgramados`, `programadas`, `canceladas`, `sustituidas`, `cerradas`, `horasPersonaProgramadas`). **Nota semántica:** refleja únicamente indicadores de programación, nunca asistencia ni cobertura efectiva.
- **Transporte Angular (F4-A):** Proxy de desarrollo de mismo origen (`proxy.conf.json`) para `/api` → `http://127.0.0.1:3000` con `openApiBaseUrl = ''` (origen actual) y `openApiBaseUrl = null` (transporte no configurado), sin habilitar CORS amplio en NestJS.
- **Pendientes vigentes en `x-sigeh-pending-resources`:**
  1. `descriptive organization fields` (`SQL column privileges not authorized`).
  2. `incidencias, cobertura, disponibilidad` (`SQL privileges and applicable business rules pending`).

---

Las pruebas QA usaron únicamente fixtures sintéticos, limpiados al final. Para una demostración persistente se necesita una preparación de datos/credenciales y activación temporal aprobadas; no hay usuarios administrativos predeterminados. El contrato queda en este repositorio para una transferencia controlada posterior, sin publicación ni cambios de AGY.
