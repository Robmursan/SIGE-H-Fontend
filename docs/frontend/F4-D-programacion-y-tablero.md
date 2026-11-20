# SIGE-H — AGY F4-D: Integración de Programación y Tablero de Coordinación

**Fecha:** 2026-11-18  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Fase:** `F4-D` (Conexión contractual de `GET /api/v1/programaciones` y `GET /api/v1/tableros/coordinacion`)  
**Estado:** **PASS**

---

## 1. Endpoints Reales Integrados (`contracts/sigeh-v1.json`)

Se sustituyeron las rutas placeholder de `SchedulingHttpService` y `ExecutiveDashboardHttpService` por las operaciones aprobadas de L3B-2A:

| Módulo | Método y Ruta | `operationId` | Parámetros contractuales exactos | Esquema de respuesta |
| :--- | :--- | :--- | :--- | :--- |
| Programación Laboral | `GET /api/v1/programaciones` | `listScopedWeeklyProgramming` | `hospitalId*`, `servicioId*`, `desde*` (ISO-8601 con zona/offset), `hasta*` (máx. `168 h`), `divisionId`, `cursor`, `limit` (`1..100`) | `SchedulePageDto` (`ScheduleReadDto[]`, `nextCursor`, `limit`, `order: 'id:asc'`) |
| Tablero de Coordinación | `GET /api/v1/tableros/coordinacion` | `getScopedProgrammingIndicators` | `hospitalId*`, `servicioId*`, `desde*` (ISO-8601 con zona/offset), `hasta*` (máx. `168 h`), `divisionId` | `ProgrammingDashboardDto` (`base: PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA` + 7 indicadores de programación) |

---

## 2. Comportamiento Implementado y Reglas Semánticas

1. **Validación estricta de ventana ISO-8601 con zona/offset y máximo 168 horas** (`src/app/core/contracts/openapi-dtos.contract.ts`):
   - `isValidIsoDateTimeWithOffset` y `validateProgrammingWindow168h` rechazan fechas sin offset de zona horaria, intervalos `hasta <= desde` y ventanas mayores a `168` horas antes de emitir solicitudes inválidas.
   - `buildDefaultLocal168hWindow` inicializa una ventana válida de 7 días (168 h) con el offset local (`±HH:MM`).
2. **Programación Laboral (`SchedulingHttpService` + `WorkSchedulingComponent`)**:
   - Conserva `SYNTHETIC_DEMO` como modo predeterminado; ofrece activación explícita **OpenAPI v1 (Opt-In)**.
   - Consume `hospitalId` y `servicioId` exclusivamente desde el contexto autorizado de `AuthSessionService`.
   - Implementa paginación `cursor`/`limit` (`Inicio` y `Siguiente (cursor)`), reiniciando el cursor y cancelando solicitudes pendientes (`takeUntil(cancelSchedule$)`) ante cualquier cambio de filtro, hospital, servicio, usuario o cierre de sesión.
   - Presenta estados de carga, vacío, error (`400`/`401`/`503`), acceso denegado (`403`) y un aviso explícito de que las alertas de cobertura e incidencias no están disponibles en `/api/v1/programaciones` (sin mezclar datos sintéticos).
3. **Tablero de Coordinación (`ExecutiveDashboardHttpService` + `ExecutiveDashboardComponent`)**:
   - Conserva `SYNTHETIC_DEMO` como modo predeterminado; ofrece activación explícita **OpenAPI v1 (Opt-In)**.
   - Respeta expresamente la semántica `PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA` mediante un banner semántico obligatorio y tarjetas exclusivas para las 7 métricas reales del backend (`jornadas`, `empleadosProgramados`, `programadas`, `canceladas`, `sustituidas`, `cerradas`, `horasPersonaProgramadas`).
   - Muestra tarjetas explícitas de **No disponible en modo real (OpenAPI v1)** para *Asistencia Efectiva*, *Cobertura Realizada* e *Incidencias Verificadas*, garantizando que ningún indicador ausente se rellene con datos sintéticos ni se confunda programación con cobertura.
   - Cancela solicitudes pendientes (`takeUntil(cancelDashboard$)`) y limpia resultados ante cambios de contexto, filtros o cierre/revocación de sesión.

---

## 3. Verificación Ejecutada

- **TypeScript (`tsc --noEmit` app y spec):** `PASS` (`0` errores)
- **Build de producción (`npm run build`):** `PASS` (`0` errores, `0` warnings)
- **Pruebas unitarias y contractuales (`npx ng test --watch=false`):** `PASS` (**24 suites / 76 pruebas aprobadas**)

---

## 4. Limitaciones a Resolver en F4-E (Validación E2E y Preparación de Demo del 22 de Noviembre)

1. **Verificación E2E contra instancia QA real en `http://127.0.0.1:3000`:** falta ejecutar el recorrido integrado real (`login → /auth/me → /organizacion → /personal → /programacion → /dashboard → refresh → logout`) contra NestJS con `IAM_V2_ENABLED=true` y `L3A_READS_ENABLED=true` sobre el proxy `/api`.
2. **Selector de contexto global unificado y conmutador de sesión/modo en el shell:** actualmente cada pantalla tiene su conmutador `Demo Sintético` / `OpenAPI v1 (Opt-In)`; en F4-E conviene revisar la fluidez del recorrido completo de demostración y las capturas visuales escritorio/móvil de ambos modos.
3. **Limitaciones contractuales del backend v1 (permanentes hasta nuevas entregas SQL):**
   - `descriptive organization fields` pendiente (hospitales y servicios se muestran por UUID).
   - `incidencias, cobertura, disponibilidad` pendiente (el tablero real muestra exclusivamente métricas de programación).
   - En `GET /api/v1/programaciones`, cada jornada entrega `empleadoId` (UUID) y `horarioId` (UUID nullable) sin nombre descriptivo del empleado en la propia respuesta.
