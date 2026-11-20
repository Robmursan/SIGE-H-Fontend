# SIGE-H — AGY F4-A: Sincronización OpenAPI (IAM/ORG + L3B-2A) y Proxy de Mismo Origen

**Fecha:** 2026-11-18  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Fase:** `F4-A` (Preparación contractual y transporte de mismo origen previa a F4-B)  
**Estado:** **PASS**

---

## 1. Validación Criptográfica y Estructural de `contracts/sigeh-v1.json`

Se verificó el contrato oficial mediante `sha256sum` y el validador determinista `scripts/validate-openapi-contract.mjs`:

- **SHA-256 aprobado y verificado:** `315c958c5d46fbdf7e6bee830d207be71b1ca0d137b74be456c300e4f05b4fdc`
- **Especificación:** OpenAPI `3.0.0` — `SIGE-H API` v`1.0.0`
- **Total de rutas / operaciones:** `19` / `19`
- **`operationId` únicos:** `19` (`0` faltantes, `0` duplicados)
- **Referencias internas `$ref`:** `80` totales, `0` sin resolver
- **Esquemas en `components.schemas`:** `23`
- **`x-sigeh-deployment`:** `"IAM, ORG and L3A reads disabled by default; temporary QA activation only; synthetic users cleaned; column SELECT grants verified in L3B-1"`

### Inventario Completo de las 19 Operaciones Verificadas

| # | Método | Ruta | `operationId` | `x-sigeh-status` | Seguridad / Proyección |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/v1` | `AppController_getHello` | `local-tested` | Pública |
| 2 | `GET` | `/api/v1/health/live` | `getHealthLive` | `local-tested` | Pública |
| 3 | `GET` | `/api/v1/health/ready` | `getHealthReady` | `local-tested` | Pública |
| 4 | `GET` | `/api/v1/health` | `getHealth` | `local-tested` | Pública |
| 5 | `GET` | `/api/v1/meta/version` | `getApiContractVersion` | `local-tested` | Pública |
| 6 | `POST` | `/api/v1/auth/login` | `iamLogin` | `qa-tested-disabled-by-default` | Credenciales |
| 7 | `POST` | `/api/v1/auth/refresh` | `iamRefresh` | `qa-tested-disabled-by-default` | Refresh token (un solo uso) |
| 8 | `GET` | `/api/v1/auth/me` | `iamMe` | `qa-tested-disabled-by-default` | `bearer` (`ProfileDto` con `assignments`) |
| 9 | `POST` | `/api/v1/auth/logout` | `iamLogout` | `qa-tested-disabled-by-default` | `bearer` |
| 10 | `GET` | `/api/v1/auth/sessions` | `iamSessions` | `qa-tested-disabled-by-default` | `bearer` |
| 11 | `DELETE` | `/api/v1/auth/sessions/{sessionId}` | `iamRevokeSession` | `qa-tested-disabled-by-default` | `bearer` |
| 12 | `GET` | `/api/v1/hospitales` | `listAuthorizedHospitals` | `qa-tested-disabled-by-default` | `bearer` · `identifiers-hierarchy-active-only` |
| 13 | `GET` | `/api/v1/hospitales/{hospitalId}/divisiones` | `listAuthorizedDivisions` | `qa-tested-disabled-by-default` | `bearer` · `identifiers-hierarchy-active-only` |
| 14 | `GET` | `/api/v1/servicios` | `listAuthorizedServices` | `qa-tested-disabled-by-default` | `bearer` · `identifiers-hierarchy-active-only` |
| 15 | `GET` | `/api/v1/empleados` | `listScopedStaff` | `qa-tested-disabled-by-default` | `bearer` (`hospitalId*`, `servicioId*`, `fecha*`) |
| 16 | `GET` | `/api/v1/empleados/{empleadoId}` | `getScopedEmployee` | `qa-tested-disabled-by-default` | `bearer` (`hospitalId*`, `servicioId*`, `fecha*`) |
| 17 | `GET` | `/api/v1/contratos/{contratoId}/adscripciones` | `listScopedAssignments` | `qa-tested-disabled-by-default` | `bearer` (`hospitalId*`, `servicioId*`, `fecha*`) |
| 18 | `GET` | `/api/v1/programaciones` | `listScopedWeeklyProgramming` | `qa-tested-disabled-by-default` | `bearer` (`hospitalId*`, `servicioId*`, `desde*`, `hasta*`) |
| 19 | `GET` | `/api/v1/tableros/coordinacion` | `getScopedProgrammingIndicators` | `qa-tested-disabled-by-default` | `bearer` (`hospitalId*`, `servicioId*`, `desde*`, `hasta*`) |

### Recursos Pendientes Declarados (`x-sigeh-pending-resources`)
1. `descriptive organization fields` — `SQL column privileges not authorized`
2. `incidencias, cobertura, disponibilidad` — `SQL privileges and applicable business rules pending`

---

## 2. Proxy de Desarrollo Angular y Configuración HTTP de Mismo Origen

- **`proxy.conf.json`**: Reenvía `/api` hacia `http://127.0.0.1:3000` (`secure: false`, `changeOrigin: false`) sin requerir CORS abierto en NestJS.
- **`angular.json`**: Enlazado en `projects.SIGE-H-Frontend.architect.serve.options.proxyConfig = "proxy.conf.json"`.
- **`src/app/core/config/environment.config.ts`**:
  - `phase`: `'F4-A'` (`appVersion: '0.4.0-f4a'`)
  - `openApiBaseUrl`: `''` (**origen actual**, despacha rutas relativas `/api/v1/...` a través del proxy)
  - `openApiBaseUrl: null` permanece reservado para **transporte no configurado** (`OPENAPI_NOT_CONFIGURED`)
  - `dataSourceMode`: `'SYNTHETIC_DEMO'` (conservado como modo predeterminado seguro)
  - `iamEnabled`: `false` (conservado deshabilitado hasta iniciar F4-B)
- **`src/app/core/http/openapi-client.base.ts`** y **`src/app/core/config/gateway-selector.service.ts`**:
  - Actualizados para evaluar `openApiBaseUrl === null` (no configurado) vs. `openApiBaseUrl === ''` (mismo origen configurado).

---

## 3. Alcance Respetado (Restricciones F4-A)

- Sin cambios en NestJS ni PostgreSQL.
- Sin implementación de IAM (`login`, `refresh`, `/auth/me`, `logout`, sesiones) todavía (reservado para **F4-B**).
- Sin conexión de los 5 endpoints L3B-2A a los componentes visuales todavía (reservado para **F4-C** a **F4-E**).
- Sin activación de endpoints reales por defecto, sin despliegues, sin commits ni pushes.

---

## 4. Verificación Ejecutada

- **Validador OpenAPI (`node scripts/validate-openapi-contract.mjs`):** `PASS` (`19` operaciones, `19` `operationId` únicos, `80` `$ref` resueltas, SHA-256 exacto).
- **TypeScript (`npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json`):** `PASS` (`0` errores).
- **Build de producción (`npm run build`):** `PASS` (`0` errores, `0` warnings).
- **Pruebas unitarias (`npx ng test --watch=false`):** `PASS` (`17` suites / `51` pruebas aprobadas).
