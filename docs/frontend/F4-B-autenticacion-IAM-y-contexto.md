# SIGE-H — AGY F4-B: Autenticación IAM V2 y Contexto Hospitalario Autorizado

**Fecha:** 2026-11-18  
**Workspace:** `/home/robreport/Documents/SIGE-H-Frontend`  
**Fase:** `F4-B` (Autenticación IAM V2 en memoria volátil, renovación single-flight, `/auth/me` y contexto autorizado)  
**Estado:** **PASS**

---

## 1. Componentes y Servicios Implementados

1. **`AuthHttpService`** (`src/app/core/http/auth-http.service.ts`):
   - Implementa exactamente las 6 operaciones IAM V2 verificadas en `contracts/sigeh-v1.json`:
     - `POST /api/v1/auth/login` (`iamLogin`) → `LoginDto` / `TokensDto`
     - `POST /api/v1/auth/refresh` (`iamRefresh`) → `RefreshDto` / `TokensDto`
     - `GET /api/v1/auth/me` (`iamMe`) → `ProfileDto`
     - `POST /api/v1/auth/logout` (`iamLogout`) → HTTP `204` (`void`)
     - `GET /api/v1/auth/sessions` (`iamSessions`) → `SessionDto[]`
     - `DELETE /api/v1/auth/sessions/{sessionId}` (`iamRevokeSession`, validación previa UUID) → HTTP `204` (`void`)
   - Excluye el encabezado `Authorization` y la renovación automática sobre `/auth/login` y `/auth/refresh` mediante `HttpContext` (`src/app/core/http/auth-http.context.ts`).

2. **`EphemeralSessionTokenStore`** (`src/app/core/security/ephemeral-session-token.store.ts`):
   - Custodia `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, `expiresAtMs` (calculado exclusivamente desde `expiresIn` del servidor), `sessionId`, `sessionStatus` y `sessionEpoch` **estrictamente en memoria RAM (Angular Signals)**.
   - Purga defensivamente claves prohibidas en `localStorage` y `sessionStorage` y expone `sessionCleared$` / `explicitLogout$` para cancelar solicitudes pendientes al cerrar sesión, cambiar de usuario o detectar revocación.

3. **`AuthRefreshCoordinatorService` y `authRefreshInterceptor`** (`src/app/core/security/auth-refresh-coordinator.service.ts`, `src/app/core/http/auth-refresh.interceptor.ts`):
   - Registrado en `src/app/app.config.ts` mediante `provideHttpClient(withInterceptors([authRefreshInterceptor]))`.
   - **Renovación single-flight:** ante N respuestas `401` simultáneas en solicitudes protegidas, despacha **exactamente una** solicitud `POST /api/v1/auth/refresh` compartida con `shareReplay(1)` y reintenta todas las solicitudes pendientes con el nuevo `accessToken`.
   - **Anti-replay y anti-bucle:** reutiliza un token recién rotado si otra solicitud en la misma época ya completó el refresh; jamás renueva sobre `/auth/login`, `/auth/refresh` ni `/auth/logout`; limita a un único reintento (`RETRIED_AFTER_AUTH_REFRESH`); limpia memoria (`revoked`) si el refresh falla o si el reintento vuelve a devolver `401`.
   - **Cancelación de pendientes:** las solicitudes protegidas en vuelo se cancelan automáticamente (`takeUntil(sessionCleared$)`) al cerrar sesión o cambiar de usuario.

4. **`AuthSessionService`** (`src/app/core/security/auth-session.service.ts`):
   - Orquesta el ciclo completo `login → tokens RAM → /auth/me → ámbitos autorizados → gestión de sesiones → logout y limpieza`.
   - Deriva hospitales y servicios autorizados **exclusivamente desde `ProfileDto.assignments`** (`/api/v1/auth/me`).
   - Rechaza explícitamente cualquier selección de `hospitalId` o `servicioId` fuera de las asignaciones del usuario (`selectHospital` / `selectService` devuelven `false` sin mutar estado).
   - Limpia inmediatamente tokens, perfil, ámbitos, sesiones y solicitudes pendientes al cerrar sesión, cambiar de usuario, revocar la sesión actual o recibir señal de revocación del interceptor.

5. **`iamAuthGuard` y `AuthLoginComponent`** (`src/app/core/security/iam-auth.guard.ts`, `src/app/features/auth-login/`):
   - `iamAuthGuard` protege `/dashboard`, `/organizacion`, `/personal` y `/programacion` **únicamente cuando `iamEnabled === true`**; por defecto (`iamEnabled === false`), `SYNTHETIC_DEMO` permanece 100% accesible sin iniciar sesión.
   - `/login` provee formulario institucional (limpiando el campo `password` en memoria inmediatamente al enviar), visualización segura de sesión (nunca muestra `accessToken` ni `refreshToken`), selector de contexto autorizado desde `/auth/me`, panel de gestión de sesiones (`/auth/sessions` + revocación) y cierre de sesión con limpieza total.

6. **Normalización de errores HTTP `400`, `401`, `403`, `404`, `429` (IAM) y `503`** (`src/app/core/http/http-error-normalizer.ts`):
   - Soporta explícitamente `IamRateLimitErrorDto` (`{ statusCode: 429, message: string }` sin campo `error`) y extrae el encabezado `Retry-After` cuando el backend lo envía.
   - Mantiene `503` como estado controlado sin bypass en cliente.

---

## 2. Limitaciones Contractuales Documentadas (Selector de Contexto Hospitalario)

Con base en el contrato oficial `contracts/sigeh-v1.json` (`SHA-256: 315c958c5d46fbdf7e6bee830d207be71b1ca0d137b74be456c300e4f05b4fdc`):

1. **Ausencia de nombres descriptivos en `/auth/me` y en Organización v1 (`x-sigeh-pending-resources: descriptive organization fields`)**:
   - `ProfileDto.assignments[].scope` expone exclusivamente UUIDs (`hospitalId`, `divisionId`, `servicioId`).
   - El selector presenta etiquetas honestas basadas en UUID (`Hospital UUID: ... (Sin nombre descriptivo en v1)`) sin inventar nombres reales ni sintéticos.
2. **Mandatos hospitalarios/divisionales sin enumeración de servicios (`servicioId: null`)**:
   - Cuando una asignación de `/auth/me` concede alcance a nivel hospital o división (`servicioId: null`) sin asignaciones explícitas por servicio, `/auth/me` no enumera los `servicioId` hijos y los usuarios de consulta no disponen de `CATALOGOS_ADMINISTRAR` para consultar `GET /api/v1/servicios`.
   - En ese escenario, `AuthSessionService` mantiene `selectedServiceId = null`, expone el aviso explícito `SERVICE_ENUMERATION_UNAVAILABLE_WITHOUT_CATALOG` y **no inventa ningún `servicioId` ni otorga `CATALOGOS_ADMINISTRAR`**.

---

## 3. Condiciones Pendientes para Prueba Real contra QA

1. Activación temporal controlada de la instancia NestJS QA en `http://127.0.0.1:3000` con IAM habilitado (actualmente deshabilitado por defecto con respuesta HTTP `503`).
2. Provisión temporal de credenciales QA sintéticas con asignaciones de prueba en `/api/v1/auth/me` (con `hospitalId` y `servicioId` explícitos para validar selectores y aislamiento multihospital).
3. Ejecución local mediante `npm start` (`ng serve` con `proxy.conf.json` enrutando `/api` → `http://127.0.0.1:3000` en mismo origen sin CORS abierto) y activación explícita de `iamEnabled: true` solo durante la sesión de prueba QA.
4. Para habilitar consultas L3B-2A en pantalla cuando el usuario posea mandato de hospital/división con `servicioId: null`, será necesario en backend un endpoint de catálogo de servicios filtrable por ámbito propio (sin requerir `CATALOGOS_ADMINISTRAR`) o asignaciones explícitas con `servicioId`.

---

## 4. Verificación Ejecutada

- **TypeScript (`tsc --noEmit` app y spec):** `PASS` (`0` errores)
- **Build de producción (`npm run build`):** `PASS` (`0` errores, `0` warnings, `Initial total: 371.70 kB` con lazy-loading por ruta)
- **Pruebas unitarias y contractuales (`npx ng test --watch=false`):** `PASS` (**22 suites / 66 pruebas aprobadas**)
  - Recorrido completo de aceptación verificado en `src/app/core/security/auth-session.service.spec.ts`: `login → RAM session → /auth/me → contexto autorizado → renovación single-flight ante 401 → logout y limpieza total`.
  - Concurrencia `401` single-flight (3 solicitudes simultáneas → exactamente 1 `POST /api/v1/auth/refresh`), anti-bucle, exclusión de `/auth/login`, `/auth/refresh` y `/auth/logout`, y cancelación de solicitudes pendientes verificados en `src/app/core/http/auth-refresh.interceptor.spec.ts`.
  - Formato especial `429` (`IamRateLimitErrorDto` + `Retry-After`) y códigos `400`, `401`, `403`, `404`, `503` verificados en `src/app/core/http/auth-http.service.spec.ts` y `src/app/core/http/http-error-normalizer.spec.ts`.
  - Protección opt-in de rutas y preservación de `SYNTHETIC_DEMO` por defecto verificadas en `src/app/core/security/iam-auth.guard.spec.ts` y `src/app/features/auth-login/auth-login.component.spec.ts`.
