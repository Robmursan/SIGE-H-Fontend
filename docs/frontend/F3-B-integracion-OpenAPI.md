# SIGE-H — AGY F3-B: Integración OpenAPI Verificada

**Fecha de entrega:** 2026-11-15  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Fase:** `F3-B` — Integración progresiva con contratos verificados `contracts/sigeh-v1.json` y `contracts/CONTRATO-SIGE-H-v1.md`  
**Estado de ejecución:** **PASS**

---

## 1. Validación e Inventario del Contrato OpenAPI v1

Se leyeron y validaron íntegramente `contracts/sigeh-v1.json` (OpenAPI `3.1.0`, versión `1.0.0`, prefijo `/api/v1`) y `contracts/CONTRATO-SIGE-H-v1.md`. El documento JSON cumple con la especificación OpenAPI 3.1 y declara explícitamente el estado operativo de cada ruta mediante `x-sigeh-status`, los requerimientos de facultad mediante `x-sigeh-faculty` y los recursos aún no habilitados en `x-sigeh-pending-resources`.

### 1.1 Clasificación de Endpoints en `contracts/sigeh-v1.json`

| Categoría contractual | Método y Ruta | `operationId` | `x-sigeh-status` | Esquema de respuesta (`200`) | Estado de integración en Angular (F3-B) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Operativos (Local-Tested)** | `GET /api/v1` | `AppController_getRoot` | `local-tested` | Objeto informativo raíz | Disponible |
| **Operativos (Local-Tested)** | `GET /api/v1/health/live` | `HealthController_getLive` | `local-tested` | `LivenessResponseDto` | **Integrado** (`SystemHealthHttpService.getHealthLive`) |
| **Operativos (Local-Tested)** | `GET /api/v1/health/ready` | `HealthController_getReady` | `local-tested` | `HealthResponseDto` (`503`: `HealthErrorResponseDto`) | **Integrado** (`SystemHealthHttpService.getHealthReady`) |
| **Operativos (Local-Tested)** | `GET /api/v1/health` | `HealthController_getHealth` | `local-tested` | `HealthResponseDto` (`503`: `HealthErrorResponseDto`) | **Integrado** (`SystemHealthHttpService.getHealth`) |
| **Operativos (Local-Tested)** | `GET /api/v1/meta/version` | `MetaController_getVersion` | `local-tested` | `ApiVersionResponseDto` | **Integrado** (`SystemHealthHttpService.getApiContractVersion`) |
| **Probados en QA / Deshabilitados por defecto (Organización)** | `GET /api/v1/hospitales` | `OrganizationController_listHospitals` | `qa-tested-disabled-by-default` | `OrganizationReferencePageDto` | **Integrado** (`OrganizationHttpService.listAuthorizedHospitals`) |
| **Probados en QA / Deshabilitados por defecto (Organización)** | `GET /api/v1/hospitales/{hospitalId}/divisiones` | `OrganizationController_listDivisions` | `qa-tested-disabled-by-default` | `OrganizationReferencePageDto` | **Integrado** (`OrganizationHttpService.listAuthorizedDivisions`) |
| **Probados en QA / Deshabilitados por defecto (Organización)** | `GET /api/v1/servicios` | `OrganizationController_listServices` | `qa-tested-disabled-by-default` | `OrganizationReferencePageDto` | **Integrado** (`OrganizationHttpService.listAuthorizedServices`) |
| **Probados en QA / Deshabilitados por defecto (IAM)** | `POST /api/v1/auth/login` | `IamController_login` | `qa-tested-disabled-by-default` | `LoginResponseDto` | **Deshabilitado** (`iamEnabled: false` por restricción de F3-B) |
| **Probados en QA / Deshabilitados por defecto (IAM)** | `POST /api/v1/auth/refresh` | `IamController_refresh` | `qa-tested-disabled-by-default` | `RefreshResponseDto` | **Deshabilitado** (`iamEnabled: false` por restricción de F3-B) |
| **Probados en QA / Deshabilitados por defecto (IAM)** | `GET /api/v1/auth/me` | `IamController_me` | `qa-tested-disabled-by-default` | `AuthenticatedPrincipalDto` | **Deshabilitado** (`iamEnabled: false` por restricción de F3-B) |
| **Probados en QA / Deshabilitados por defecto (IAM)** | `POST /api/v1/auth/logout` | `IamController_logout` | `qa-tested-disabled-by-default` | `LogoutResponseDto` | **Deshabilitado** (`iamEnabled: false` por restricción de F3-B) |
| **Probados en QA / Deshabilitados por defecto (IAM)** | `GET /api/v1/auth/sessions` | `IamController_listSessions` | `qa-tested-disabled-by-default` | `SessionSummaryDto[]` | **Deshabilitado** (`iamEnabled: false` por restricción de F3-B) |
| **Probados en QA / Deshabilitados por defecto (IAM)** | `DELETE /api/v1/auth/sessions/{sessionId}` | `IamController_revokeSession` | `qa-tested-disabled-by-default` | `LogoutResponseDto` | **Deshabilitado** (`iamEnabled: false` por restricción de F3-B) |

### 1.2 Recursos Pendientes Declarados en `x-sigeh-pending-resources`

El propio contrato `contracts/sigeh-v1.json` documenta cuatro bloques aún no publicados en el backend:

1. **`descriptive organization fields`**: Campos `nombre`, `clave`, `zonaHoraria`, ubicación física, turnos habilitados y responsables de hospitales, divisiones y servicios (`SQL column privileges are not authorized yet`).
2. **`personal and adscripciones`**: Directorio de personal, categorías nominales, funciones operativas y adscripciones (`SQL SELECT privileges and read-faculty matrix are pending`).
3. **`programacion and operational dashboard`**: Calendario semanal de programación laboral y agregados del dashboard ejecutivo (`SQL SELECT privileges and read-faculty matrix are pending`).
4. **`incidencias, cobertura, disponibilidad`**: Alertas de cobertura e incidencias operativas (`SQL privileges and business rules are pending`).

---

## 2. Adaptadores HTTP Concretos y DTOs Consumidos

### 2.1 Servicio HTTP de Organización (`src/app/core/http/organization-http.service.ts`)

Se implementó el adaptador concreto `OrganizationHttpService` apuntando exclusivamente a las rutas documentadas en `contracts/sigeh-v1.json`:

- **`listAuthorizedHospitals(params)`** → `GET /api/v1/hospitales`
  - Query params soportados: `hospitalId` (UUID opcional), `activo` (boolean opcional), `cursor` (UUID opcional), `limit` (`1..100`, default `50`).
- **`listAuthorizedDivisions(hospitalId, params)`** → `GET /api/v1/hospitales/{hospitalId}/divisiones`
  - Path param obligatorio: `hospitalId` (UUID validado antes de emitir la petición).
  - Query params soportados: `activo` (boolean opcional), `cursor` (UUID opcional), `limit` (`1..100`, default `50`).
- **`listAuthorizedServices(params)`** → `GET /api/v1/servicios`
  - Query params soportados: `hospitalId` (UUID **obligatorio** según contrato), `divisionId` (UUID opcional), `servicioId` (UUID opcional), `activo` (boolean opcional), `cursor` (UUID opcional), `limit` (`1..100`, default `50`).
- **`queryOrganization(query)`** → Orquesta la consulta jerárquica real (`hospitales` → `divisiones` del hospital seleccionado → `servicios` del hospital/división seleccionados) y transforma las tres páginas `OrganizationReferencePageDto` en `OrganizationExplorerSnapshot` mediante funciones puras.

### 2.2 Servicio HTTP de Salud y Metadatos (`src/app/core/http/system-health-http.service.ts`)

Se implementó `SystemHealthHttpService` para consumir los endpoints operativos `local-tested`:

- `getHealthLive()` → `GET /api/v1/health/live` (`LivenessResponseDto`)
- `getHealthReady()` → `GET /api/v1/health/ready` (`HealthResponseDto`)
- `getHealth()` → `GET /api/v1/health` (`HealthResponseDto`)
- `getApiContractVersion()` → `GET /api/v1/meta/version` (`ApiVersionResponseDto`)

### 2.3 Esquemas DTO y Campos Realmente Consumidos (`src/app/core/contracts/openapi-dtos.contract.ts`)

- **`OrganizationReferenceDto`**:
  - `id: string` (UUID)
  - `hospitalId: string` (UUID)
  - `divisionId: string | null` (UUID nullable)
  - `servicioId: string | null` (UUID nullable)
  - `activo: boolean`
- **`OrganizationReferencePageDto`**:
  - `items: readonly OrganizationReferenceDto[]`
  - `nextCursor: string | null` (UUID nullable)
  - `limit: number` (`1..100`)
  - `order: 'id:asc'`
- **Funciones de transformación explícitas (Anti-Corruption Layer)**:
  - `mapOrganizationReferenceToHospital(dto, divisionsCount, servicesCount)`
  - `mapOrganizationReferenceToDivision(dto, servicesCount)`
  - `mapOrganizationReferenceToService(dto)`
  - `mapOrganizationReferencePagesToSnapshot(bundle)`

---

## 3. Diferencias entre Contratos Frontend (F2/F3-A) y Backend OpenAPI v1 (F3-B)

| Aspecto | Modelo de Vista Angular (F2 / F3-A) | Contrato Backend Verificado (`contracts/sigeh-v1.json`) | Resolución implementada en F3-B |
| :--- | :--- | :--- | :--- |
| **Proyección de Organización** | Incluye nombres descriptivos, claves institucionales, nivel hospitalario, ubicación física, modalidad de atención, turnos habilitados, responsables y conteos de plantilla. | `x-sigeh-projection: "identifiers-hierarchy-active-only"`. Solo expone `id`, `hospitalId`, `divisionId`, `servicioId` y `activo`. | `mapOrganizationReferenceTo*` mapea los UUIDs y `activo` reales, marca `isLimitedProjection: true`, deja conteos en `null` (`No disponible (v1)`) y vacía arreglos de turnos y responsables. |
| **Responsables, Ubicación y Turnos en UI** | Tarjetas de responsables, chips de turnos y ubicación física poblados en demostración sintética. | Omitidos en v1 hasta autorización de privilegios SQL de columnas descriptivas. | En `OrganizationExplorerComponent` se agregaron estados explícitos de **Información no disponible en proyección v1** (`[data-testid="shifts-unavailable-notice"]`, `[data-testid="responsibles-unavailable-notice"]` y etiquetas `No disponible en proyección OpenAPI v1 (identifiers-hierarchy-active-only)`). No se inventan datos ni se mezclan datos sintéticos con respuestas reales. |
| **Esquema de Paginación** | Paginación por número de página (`page`, `pageSize`) en directorio de personal. | Paginación por cursor (`cursor` UUID, `limit` 1..100, respuesta `{ items, nextCursor, limit, order: 'id:asc' }`). | `OrganizationQueryParams` y `OrganizationExplorerSnapshot` incorporan `cursor`, `limit` y `cursorPagination: { nextCursor, limit, order }`. |
| **Parámetros de Filtrado en Organización** | Filtro de texto libre (`searchTerm`) y filtro por modalidad de turno (`shift`). | Filtrado estricto por identificadores UUID (`hospitalId`, `divisionId`, `servicioId`) y booleano `activo`. | `OrganizationHttpService` envía únicamente los query params aceptados por `contracts/sigeh-v1.json` (`hospitalId`, `divisionId`, `servicioId`, `activo`, `cursor`, `limit`) y valida formato UUID para prevenir errores `400`. |
| **Códigos de Estado HTTP** | Normalizador F3-A cubría `401`, `403`, `404`, `409`, `500` y `0`. | El contrato v1 añade `400` (validación de query/UUID), `429` (rate limit) y `503` (módulo IAM/ORG deshabilitado por defecto o PostgreSQL no disponible). | `normalizeOpenApiHttpError` ahora normaliza `400` (`BAD_REQUEST_VALIDATION`), `429` (`RATE_LIMIT_EXCEEDED`) y `503` (`SERVICE_DISABLED_OR_UNAVAILABLE`), extrayendo además mensajes detallados de NestJS (`{ statusCode, message, error }`). |
| **Módulos de Dashboard, Personal y Programación** | Vistas completas listas con puertos `Gateway` y adaptadores sintéticos. | Pendientes en `x-sigeh-pending-resources` (sin endpoints publicados en v1). | Se mantienen en `SYNTHETIC_DEMO` por defecto; si se invocan sus servicios HTTP reales sin backend habilitado, devuelven un estado controlado sin inventar datos ni presentar respuestas ficticias como reales. |

---

## 4. Configuración de Entorno y Seguridad

En `src/app/core/config/environment.config.ts`:
- `phase`: `'F3-B'`
- `dataSourceMode`: `'SYNTHETIC_DEMO'` (modo predeterminado seguro para demostración ejecutiva; la estabilidad del Dashboard, Personal, Programación y Organización permanece intacta).
- `openApiBaseUrl`: `'http://127.0.0.1:3000'` (configurado como destino local de integración para cuando NestJS esté ejecutándose).
- `apiBasePath`: `'api/v1'`
- `iamEnabled`: `false` (integración IAM deshabilitada hasta autorización específica; cero persistencia de tokens en `localStorage` o `sessionStorage`).

---

## 5. Verificación: Build, Pruebas Unitarias y Validación Visual

### 5.1 Build de Producción
- Comando: `npm run build`
- Resultado: **PASS** (0 errores, 0 advertencias de presupuesto CSS/JS, bundle generado en `dist/SIGE-H-Frontend`).

### 5.2 Pruebas Unitarias y Pruebas HTTP Contractuales
- Comando: `npx ng test --watch=false`
- Resultado: **16 suites aprobadas / 47 pruebas unitarias aprobadas (100% PASS)**.
- Nuevas pruebas añadidas en F3-B:
  - `src/app/core/http/organization-http.service.spec.ts` (4 pruebas):
    1. Orquestación completa de `GET /api/v1/hospitales`, `GET /api/v1/hospitales/{hospitalId}/divisiones` y `GET /api/v1/servicios` con respuestas contractuales `OrganizationReferencePageDto`, verificando query params (`hospitalId`, `divisionId`, `limit`) y mapeo sin invención de campos.
    2. Manejo de `503 Service Unavailable` cuando el módulo `ORG` está deshabilitado por defecto en el backend (`SERVICE_DISABLED_OR_UNAVAILABLE`).
    3. Rechazo preventivo de `hospitalId` no-UUID (`BAD_REQUEST_VALIDATION` / `400`) y manejo de `403 Forbidden` por falta de facultad `CATALOGOS_ADMINISTRAR`.
    4. Consumo de `GET /api/v1/health/live` y `GET /api/v1/meta/version` en `SystemHealthHttpService`.
  - `src/app/core/contracts/openapi-dtos.contract.spec.ts`: Pruebas unitarias de `mapOrganizationReferenceToHospital`, `mapOrganizationReferenceToDivision`, `mapOrganizationReferenceToService` y `mapOrganizationReferencePagesToSnapshot`.
  - `src/app/core/http/http-error-normalizer.spec.ts`: Pruebas para códigos HTTP `400`, `429` y `503`.
  - `src/app/features/organization-explorer/organization-explorer.component.spec.ts`: Verificación visual en DOM de los avisos explícitos `[data-testid="shifts-unavailable-notice"]`, `[data-testid="responsibles-unavailable-notice"]` y etiquetas `No disponible (v1)` cuando se recibe una proyección limitada de OpenAPI v1.

### 5.3 Capturas de Validación Visual
Se verificó el renderizado en navegador Chromium headless tanto de Organización como del Dashboard Ejecutivo:
- Escritorio (`/organizacion`): `docs/frontend/screenshots/f3b-organizacion-desktop.png`
- Móvil (`/organizacion`): `docs/frontend/screenshots/f3b-organizacion-mobile.png`
- Escritorio (`/dashboard`): `docs/frontend/screenshots/f3b-dashboard-desktop.png`

---

## 6. Bloqueos Pendientes en Backend para Siguientes Fases

1. **Campos descriptivos de Organización (`x-sigeh-pending-resources: descriptive organization fields`)**: El backend aún no cuenta con autorización de privilegios SQL sobre las columnas descriptivas (`nombre`, `clave`, `zonaHoraria`, ubicación física, turnos habilitados y responsables). Mientras tanto, Angular muestra estados explícitos de información no disponible cuando consume `/api/v1/hospitales`, `/divisiones` y `/servicios`.
2. **Endpoints de Personal, Programación, Dashboard e Incidencias (`x-sigeh-pending-resources`)**: Pendientes de privilegios `SQL SELECT` y matriz de facultades de lectura en el backend NestJS.
3. **Activación en tiempo de ejecución de módulos `ORG` e `IAM` (`qa-tested-disabled-by-default`)**: Los endpoints de Organización requieren una sesión autenticada con facultad `CATALOGOS_ADMINISTRAR` y que el módulo `ORG` esté habilitado en la instancia local de NestJS (`http://127.0.0.1:3000`); de lo contrario, el backend responde `503 Service Unavailable`, caso que Angular ya captura y presenta de forma segura.

---

**Conclusión de Fase F3-B:** **PASS**
