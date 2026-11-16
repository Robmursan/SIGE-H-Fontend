# Informe Técnico — Fase F3-A: Preparación de Integración API (SIGE-H)

- **Proyecto:** SIGE-H (`SIGE-H-Frontend`)
- **Fase:** F3-A — Preparación de Integración API y Contratos OpenAPI
- **Estado de Entrega:** **PASS**

---

## 1. Inventario de Modelos de Dominio, Puertos, Adaptadores y Servicios HTTP (F1–F3-A)

| Dominio / Módulo | Modelo de Dominio (Sin duplicación) | Puerto (Gateway Token) | Adaptador Sintético (Modo Demo Seguro) | Servicio HTTP Tipado (OpenAPI Ready) | Proxy Configurable (F3-A) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tablero Ejecutivo (F1)** | `src/app/core/models/executive-dashboard.model.ts` (`ExecutiveDashboardSnapshot`, `KpiMetric`, `ServiceCoverageItem`, `AttendanceSummary`, `OperationalIncident`) | `EXECUTIVE_DASHBOARD_GATEWAY` (`executive-dashboard.gateway.ts`) | `SyntheticExecutiveDashboardAdapter` (`synthetic-executive-dashboard.adapter.ts`) | `ExecutiveDashboardHttpService` (`executive-dashboard-http.service.ts`) | `ConfigurableExecutiveDashboardGateway` |
| **Organización Hospitalaria (F2)** | `src/app/core/models/organization.model.ts` (`OrganizationExplorerSnapshot`, `HospitalInstitution`, `HospitalDivision`, `HospitalServiceUnit`, `ServiceResponsible`) | `ORGANIZATION_GATEWAY` (`organization.gateway.ts`) | `SyntheticOrganizationAdapter` (`synthetic-organization.adapter.ts`) | `OrganizationHttpService` (`organization-http.service.ts`) | `ConfigurableOrganizationGateway` |
| **Gestión de Personal (F2)** | `src/app/core/models/personnel.model.ts` (`PersonnelDirectorySnapshot`, `StaffMemberRecord`, `InstitutionalAffiliation`, `PersonnelPaginationMeta`) | `PERSONNEL_GATEWAY` (`personnel.gateway.ts`) | `SyntheticPersonnelAdapter` (`synthetic-personnel.adapter.ts`) | `PersonnelHttpService` (`personnel-http.service.ts`) | `ConfigurablePersonnelGateway` |
| **Programación Laboral (F2)** | `src/app/core/models/scheduling.model.ts` (`WeeklyScheduleSnapshot`, `WeeklyStaffScheduleRow`, `DailyScheduleCell`, `CoverageAlertItem`, `ScheduleSchemeSummary`) | `SCHEDULING_GATEWAY` (`scheduling.gateway.ts`) | `SyntheticSchedulingAdapter` (`synthetic-scheduling.adapter.ts`) | `SchedulingHttpService` (`scheduling-http.service.ts`) | `ConfigurableSchedulingGateway` |
| **Transporte, Seguridad y Mapeo DTO (F3-A)** | `src/app/core/contracts/openapi-dtos.contract.ts` (`ExecutiveDashboardOpenApiDto`, `OrganizationExplorerOpenApiDto`, `PersonnelDirectoryOpenApiDto`, `WeeklyScheduleOpenApiDto`) | `SIGEH_RUNTIME_CONFIG` (`environment.config.ts`) | `GatewaySelectorService` (`gateway-selector.service.ts`) | `OpenApiClientBaseService` + `normalizeOpenApiHttpError` (`http-error-normalizer.ts`) | `EphemeralSessionTokenStore` (`ephemeral-session-token.store.ts`) |

---

## 2. Datos Exactos Requeridos por Pantalla

### 2.1 Vista 1: Tablero Ejecutivo (`/dashboard`)
- **Componente:** `ExecutiveDashboardComponent`
- **Datos requeridos:**
  - `kpis`: 4 tarjetas métricas (`personal`, `asistencia`, `incidencias`, `cobertura`) con `value`, `formattedValue`, `unit`, `targetLabel`, `compliancePercentage`, `deltaLabel`, `status` (`optimal` | `warning` | `critical`).
  - `serviceCoverage`: Lista de servicios clínicos con `serviceId`, `serviceName`, `floorOrWing`, `shift`, `requiredStaff`, `assignedStaff`, `presentStaff`, `coveragePercentage`, `status`, `supervisorNote`.
  - `attendance`: Resumen consolidado (`totalScheduled`, `totalPresent`, `punctualityPercentage`, `justifiedAbsences`, `unjustifiedAbsences`, `activeSubstitutions`, `delayedCheckIns`) y arreglo `categories` por categoría de enfermería.
  - `incidents`: Lista de incidencias operativas del turno (`incidentId`, `category`, `severity`, `serviceName`, `shift`, `reportedTime`, `resolutionStatus`, `summary`).

### 2.2 Vista 2: Organización Hospitalaria (`/organizacion`)
- **Componente:** `OrganizationExplorerComponent`
- **Datos requeridos:**
  - `hospitals`: Catálogo de hospitales (`hospitalId`, `hospitalCode`, `hospitalName`, `levelCode`, `regionDemo`, `nursingDirectorDemo`, `divisionsCount`, `servicesCount`, `activeStaffTotal`).
  - `selectedHospital`: Hospital activo seleccionado.
  - `divisions`: Divisiones clínicas del hospital activo (`divisionId`, `divisionCode`, `divisionName`, `divisionChiefDemo`, `servicesCount`, `totalAuthorizedStaff`, `totalActiveStaff`).
  - `services`: Servicios filtrados del hospital/división (`serviceId`, `serviceCode`, `serviceName`, `divisionName`, `physicalLocation`, `careModality`, `authorizedPositions`, `activeStaffCount`, `enabledShifts`, `operationalStatus`, `operationalNotes`).
  - `selectedService`: Servicio en inspección con su lista `responsibles` (`roleTitle`, `syntheticName`, `employeeCode`, `shiftScope`, `extensionDemo`).

### 2.3 Vista 3: Gestión de Personal (`/personal`)
- **Componente:** `PersonnelManagementComponent`
- **Datos requeridos:**
  - `indicators`: 4 indicadores KPI de plantilla (`Plantilla Filtrada`, `Personal Activo`, `Incapacidades/Licencias/Vacaciones`, `Especialistas y Jefaturas`).
  - `items`: Página activa de registros `StaffMemberRecord` (`employeeId`, `employeeNumberDemo`, `fullNameDemo`, `nominalCategory`, `operationalFunction`, `employmentStatus`, `statusSeverity`, `professionalLicenseDemo`, `specialtyTag`, `lastRosterCheckDemo`, `supervisorObservations`, `affiliation`).
  - `affiliation`: Objeto de adscripción institucional (`hospitalId`, `hospitalName`, `divisionName`, `serviceId`, `serviceName`, `positionCodeDemo`, `contractModalityDemo`, `baseShift`, `scheduleScheme`, `seniorityYearsDemo`).
  - `pagination`: Metadatos de paginación (`currentPage`, `pageSize`, `totalItems`, `totalPages`, `startItemIndex`, `endItemIndex`).
  - `selectedEmployee`: Ficha completa del empleado seleccionado.
  - `availableHospitals` y `availableServices`: Catálogos ligeros para los selectores de filtro.

### 2.4 Vista 4: Programación Laboral Semanal (`/programacion`)
- **Componente:** `WorkSchedulingComponent`
- **Datos requeridos:**
  - `weekRangeLabel` y `weekDaysHeader` (7 columnas `dayIso`, `dayShortLabel`, `dayNumberLabel`, `isWeekend`).
  - `schemeSummaries`: 3 resúmenes de esquema horario (`Horario Diurno`, `Jornada Acumulada`, `Guardia Nocturna`) con conteo de personal y código de turno.
  - `rows`: Filas semanales por trabajador (`rowId`, `employeeId`, `employeeNameDemo`, `employeeNumberDemo`, `nominalCategory`, `serviceName`, `scheduleScheme`, `primaryShift`, `days[7]`).
  - `days[0..6]`: Celdas diarias (`assignmentType`: `'DIURNO_MATUTINO' | 'DIURNO_VESPERTINO' | 'GUARDIA_NOCTURNA' | 'JORNADA_ACUMULADA' | 'DESCANSO_POST_GUARDIA' | 'DESCANSO_PROGRAMADO' | 'INCIDENCIA_AUSENCIA'`, `shortCode`, `displayLabel`, `timeWindowLabel`, `hasAlert`, `noteDemo`).
  - `coverageAlerts`: Alertas iniciales de cobertura semanal (`alertId`, `dayLabel`, `serviceName`, `shiftLabel`, `scheme`, `severity`, `requiredCount`, `scheduledCount`, `description`).

---

## 3. Matriz de Correspondencia: Vistas, DTOs, Filtros, Paginación y Permisos

| Vista / Ruta | Servicio HTTP Preparado | DTO OpenAPI Requerido | Filtros / Query Params (`HttpParams`) | Paginación | Permisos / Roles Esperados (IAM futuro) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tablero Ejecutivo** (`/dashboard`) | `ExecutiveDashboardHttpService` | `ExecutiveDashboardOpenApiDto` → `ExecutiveDashboardSnapshot` | `shift` (`ALL` \| `Matutino` \| `Vespertino` \| `Nocturno`), `serviceQuery` (`string`), `statusFilter` (`ALL` \| `optimal` \| `warning` \| `critical`) | No aplica (vista agregada ejecutiva) | `ROL_SUPERVISOR_ENFERMERIA`, `ROL_JEFATURA_DIVISION`, `ROL_DIRECCION_ENFERMERIA` (Solo lectura) |
| **Organización Hospitalaria** (`/organizacion`) | `OrganizationHttpService` | `OrganizationExplorerOpenApiDto` → `OrganizationExplorerSnapshot` | `hospitalId` (`string`), `divisionId` (`ALL` \| `string`), `searchQuery` (`string`), `statusFilter` (`ALL` \| `OperationalStatus`), `selectedServiceId` (`string`) | No aplica (árbol jerárquico por unidad) | `ROL_SUPERVISOR_ENFERMERIA`, `ROL_JEFATURA_SERVICIO`, `ROL_JEFATURA_DIVISION` (Solo lectura) |
| **Gestión de Personal** (`/personal`) | `PersonnelHttpService` | `PersonnelDirectoryOpenApiDto` → `PersonnelDirectorySnapshot` | `hospitalId` (`ALL` \| `string`), `serviceId` (`ALL` \| `string`), `nominalCategory` (`ALL` \| `NominalCategory`), `employmentStatus` (`ALL` \| `EmploymentStatus`), `searchQuery` (`string`), `selectedEmployeeId` (`string`) | **Sí**: `page` (`number >= 1`), `pageSize` (`5` \| `10` \| `12`) → `PersonnelPaginationMeta` | `ROL_SUPERVISOR_ENFERMERIA`, `ROL_JEFATURA_DIVISION`, `ROL_RH_ENFERMERIA` (Solo lectura en F2/F3-A) |
| **Programación Laboral** (`/programacion`) | `SchedulingHttpService` | `WeeklyScheduleOpenApiDto` → `WeeklyScheduleSnapshot` | `hospitalId` (`ALL` \| `string`), `serviceId` (`ALL` \| `string`), `shiftFilter` (`ALL` \| `ShiftType` \| `Jornada Acumulada`), `schemeFilter` (`ALL` \| `ScheduleSchemeType`), `searchQuery` (`string`) | Por ventana semanal de 7 días (`weekDaysHeader`) | `ROL_SUPERVISOR_ENFERMERIA`, `ROL_JEFATURA_SERVICIO`, `ROL_JEFATURA_DIVISION` (Solo lectura inicial) |
| **Control de Acceso** (`/acceso-restringido`) | `UiStatePanelComponent` (`state="forbidden"`) | `NormalizedHttpError` / `DashboardApiError` (`code: 'FORBIDDEN_ROLE'`) | N/A | N/A | Vista de contingencia ante respuesta `HTTP 403` |

---

## 4. Revisión de Contratos OpenAPI en el Workspace (Disponibles vs. Faltantes)

Se inspeccionó el árbol completo de `/home/robreport/Documents/SIGE-H-Frontend` (sin acceder al backend ni fuera del workspace permitido):

- **Contratos Frontend Disponibles en `SIGE-H-Frontend`**:
  - Contratos TypeScript de dominio e interfaces DTO anti-corrupción en `src/app/core/contracts/openapi-dtos.contract.ts`.
  - Clientes HTTP tipados listos en `src/app/core/http/`.
- **Artefactos OpenAPI Faltantes (Pendientes de Entrega por Backend/Codex para F3-B)**:
  - No existe aún un archivo `openapi.json` ni `openapi.yaml` exportado dentro de `/home/robreport/Documents/SIGE-H-Frontend`.
  - Faltan las rutas definitivas verificadas del backend NestJS para:
    1. Consulta ejecutiva de tablero (`ExecutiveDashboardOpenApiDto`).
    2. Consulta jerárquica de hospitales, divisiones, servicios y responsables (`OrganizationExplorerOpenApiDto`).
    3. Consulta paginada de plantilla nominal y adscripción (`PersonnelDirectoryOpenApiDto`).
    4. Consulta de programación semanal de 7 días y alertas de cobertura (`WeeklyScheduleOpenApiDto`).

---

## 5. Mecanismo Configurable de Selección, Manejo de Errores y Seguridad

1. **Conmutador Configurable Sintético vs. Servicio Real (`GatewaySelectorService`)**:
   - Implementado en `src/app/core/config/gateway-selector.service.ts` y registrado en `src/app/app.config.ts` mediante `provideSigehConfigurableGateways()`.
   - Mantiene **`SYNTHETIC_DEMO` como opción predeterminada y segura** para demostraciones ejecutivas.
   - Permite cambiar globalmente (`setGlobalMode('OPENAPI_HTTP_READY')`) o por módulo individual (`setModuleMode('organization', 'OPENAPI_HTTP_READY')`).
   - Incluye salvaguarda `enforceSyntheticFallbackWhenUnconfigured` para preservar el modo sintético si aún no se ha inyectado `openApiBaseUrl`.
2. **Manejo Uniforme de Errores HTTP (`401`, `403`, `404`, `409`, `500`)**:
   - Implementado en `src/app/core/http/http-error-normalizer.ts`:
     - `401` → `UNAUTHORIZED_SESSION` (estado `error`, aviso de sesión no autenticada o expirada).
     - `403` → `FORBIDDEN_ROLE` (estado `forbidden`, renderiza panel institucional 403 con rol requerido).
     - `404` → `RESOURCE_NOT_FOUND` (estado `error`, recurso no localizado en catálogo).
     - `409` → `CONFLICT_STATE` (estado `error`, conflicto de integridad o superposición de turno).
     - `500/502/503/504` → `INTERNAL_SERVER_ERROR` (estado `error`, fallo del servidor central con opción de reintento).
3. **Política Estricta Sin `localStorage` para Tokens Sensibles**:
   - Implementado en `src/app/core/security/ephemeral-session-token.store.ts` (`EphemeralSessionTokenStore`).
   - Almacena cualquier token futuro únicamente en memoria RAM volátil (`signal<string | null>(null)`) y purga activamente claves prohibidas (`access_token`, `refresh_token`, `jwt`, `sigeh_jwt`, etc.) de `localStorage` y `sessionStorage`.
4. **Desacoplamiento de PostgreSQL**:
   - Los mapeadores puros en `src/app/core/contracts/openapi-dtos.contract.ts` aseguran que ninguna vista Angular dependa de nombres de tablas, claves foráneas crudas o tipos internos de PostgreSQL.

---

## 6. Resultados de Build y Pruebas Unitarias

- **Build de Producción (`npm run build`)**:
  - **Resultado:** Exitoso (`exit code 0`), **0 errores y 0 advertencias**.
- **Pruebas Unitarias (`npx ng test --watch=false`)**:
  - **Resultado:** **15 suites aprobadas (15/15), 39 pruebas unitarias aprobadas (39/39)**:
    - 11 suites previas de F1 y F2 (29 pruebas).
    - `src/app/core/http/http-error-normalizer.spec.ts` (5 pruebas: `401`, `403`, `404`, `409`, `500`).
    - `src/app/core/security/ephemeral-session-token.store.spec.ts` (2 pruebas: memoria volátil y purga de `localStorage`/`sessionStorage`).
    - `src/app/core/config/gateway-selector.service.spec.ts` (2 pruebas: selección dinámica por módulo y fallback seguro).
    - `src/app/core/contracts/openapi-dtos.contract.spec.ts` (1 prueba: mapeo anticorrupción DTO → Dominio).

---

## 7. Bloqueos para F3-B

Para ejecutar la conexión real en **F3-B** se requiere únicamente:
1. **Entrega del archivo de especificación OpenAPI verificado** (p. ej. `docs/contracts/openapi.json` o similar) dentro del workspace para confirmar las rutas exactas de los endpoints GET de NestJS.
2. **Definición de la URL base de desarrollo/integración** (`openApiBaseUrl`) autorizada para pruebas de integración.
