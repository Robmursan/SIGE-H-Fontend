# SIGE-H — AGY F4-C: Integración Funcional de Personal y Adscripciones

**Fecha:** 2026-11-18  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Fase:** `F4-C` (Conexión contractual de padrón, detalle de empleado y adscripciones por contrato)  
**Estado:** **PASS**

---

## 1. Endpoints Reales Integrados (`contracts/sigeh-v1.json`)

Se sustituyó por completo la ruta placeholder `/openapi-pending-contract/personnel-directory` en `src/app/core/http/personnel-http.service.ts` por los tres endpoints aprobados en L3B-2A:

| Operación | Método y Ruta | `operationId` | Parámetros contractuales | Esquema de respuesta |
| :--- | :--- | :--- | :--- | :--- |
| Padrón vigente | `GET /api/v1/empleados` | `listScopedStaff` | `hospitalId*`, `servicioId*`, `fecha*`, `divisionId`, `cursor`, `limit` (`1..100`) | `EmployeePageDto` (`EmployeeReadDto[]`, `nextCursor`, `limit`, `order: 'id:asc'`) |
| Detalle mínimo de empleado | `GET /api/v1/empleados/{empleadoId}` | `getScopedEmployee` | `empleadoId*` (path), `hospitalId*`, `servicioId*`, `fecha*`, `divisionId`, `cursor`, `limit` | `EmployeeDetailDto` (`empleado`, `adscripciones: AssignmentPageDto`) |
| Adscripciones por contrato | `GET /api/v1/contratos/{contratoId}/adscripciones` | `listScopedAssignments` | `contratoId*` (path), `hospitalId*`, `servicioId*`, `fecha*`, `divisionId`, `cursor`, `limit` | `AssignmentPageDto` (`AssignmentReadDto[]`, `nextCursor`, `limit`, `order: 'id:asc'`) |

---

## 2. DTOs, Mappers y Seguridad de Proyección

- **DTOs exactos** en `src/app/core/contracts/openapi-dtos.contract.ts`: `EmployeeReadDto`, `EmployeePageDto`, `AssignmentReadDto`, `AssignmentPageDto`, `EmployeeDetailDto`, `ScopedStaffQueryParams`.
- **Funciones puras de transformación:** `mapEmployeeReadDtoToStaffRecord`, `mapAssignmentReadDtoToDomain`, `mapEmployeePageDtoToSnapshot`, `mapEmployeeDetailDtoToDomain`.
- **Sin RUD ni propiedades inventadas:** solo se consumen `empleadoId`, `nombres`, `primerApellido`, `activo`, `adscripcionId`, `contratoId`, `servicioId`, `clase` (`NOMINAL` / `OPERATIVA`), `inicio` y `fin` (`string | null`). Los campos excluidos de la proyección v1 se marcan con estados explícitos de información no disponible y no se inventan KPIs de plantilla.
- **Autorización en NestJS:** `PersonnelHttpService` y `PersonnelManagementComponent` utilizan los ámbitos autorizados de `AuthSessionService` (`/api/v1/auth/me`) para formular solicitudes; NestJS valida todas las facultades y el aislamiento multihospital.

---

## 3. Componentes Funcionales y Manejo de Estados (`PersonnelManagementComponent`)

- **Modo seguro por defecto (`SYNTHETIC_DEMO`) conservado:** la vista `/personal` sigue iniciando en demostración sintética sin emitir tráfico HTTP hasta activar explícitamente el botón **OpenAPI v1 (Opt-In)**.
- **Recorrido visual completo en modo OpenAPI v1:**
  1. **Filtros contractuales:** selector de hospital autorizado, selector de servicio autorizado (`servicioId`), selector de fecha de vigencia (`fecha`, `YYYY-MM-DD`), límite por bloque (`limit`) y paginación por cursor (`cursor` / `nextCursor` con botones `Inicio` y `Siguiente (cursor)`).
  2. **Padrón (`GET /api/v1/empleados`):** tabla limpia con UUID, nombre completo (`nombres + primerApellido`) y estado `Activo`/`Inactivo`.
  3. **Detalle de empleado (`GET /api/v1/empleados/{empleadoId}`):** al seleccionar una fila, muestra el detalle mínimo y sus adscripciones visibles (`NOMINAL` / `OPERATIVA`, `inicio`, `fin ?? 'Vigente'`), junto a botones para consultar cada `contratoId` único.
  4. **Adscripciones por contrato (`GET /api/v1/contratos/{contratoId}/adscripciones`):** muestra todas las adscripciones vigentes del contrato dentro del servicio autorizado, con paginación por cursor propia.
- **Cancelación y limpieza estricta:**
  - Al cambiar cualquier filtro (`hospital`, `servicioId`, `fecha`, `limit`) se cancelan solicitudes pendientes (`takeUntil(cancel*)`), se reinicia el `cursor` y se limpian resultados anteriores (detalle y contratos).
  - Al cambiar de usuario, cambiar de contexto en `AuthSessionService`, cerrar sesión (`tokenStore.sessionCleared$`) o recibir error de autorización (`401`/`403`/`404`/`503`), se cancelan solicitudes pendientes y se eliminan resultados previos sin exposición residual de datos.

---

## 4. Limitaciones y Condiciones Pendientes para Validación E2E

1. **Sin campos descriptivos de hospital/servicio en v1:** los selectores muestran identificadores UUID de `/auth/me` (`descriptive organization fields` sigue en `x-sigeh-pending-resources`).
2. **Mandatos hospitalarios/divisionales con `servicioId: null`:** dado que `GET /api/v1/empleados` requiere `servicioId` UUID obligatorio, si un usuario solo tiene mandato de hospital/división sin servicios explícitos en `/auth/me`, el componente muestra el aviso de limitación de catálogo y no inventa `servicioId`.
3. **Condiciones para validación E2E contra QA:**
   - Instancia temporal autorizada de NestJS QA en `http://127.0.0.1:3000` con `IAM_V2_ENABLED=true` y `L3A_READS_ENABLED=true` (actualmente deshabilitados por defecto con HTTP `503`).
   - Usuario QA sintético con asignación en `/auth/me` que incluya `hospitalId` y `servicioId` explícitos y datos de prueba vigentes a la `fecha` consultada.
   - Ejecución de Angular vía `npm start` (proxy `/api` → `http://127.0.0.1:3000` en mismo origen).

---

## 5. Verificación Ejecutada

- **TypeScript (`tsc --noEmit` app y spec):** `PASS` (`0` errores)
- **Build de producción (`npm run build`):** `PASS` (`0` errores, `0` warnings)
- **Pruebas unitarias y contractuales (`npx ng test --watch=false`):** `PASS` (**23 suites / 70 pruebas aprobadas**)
