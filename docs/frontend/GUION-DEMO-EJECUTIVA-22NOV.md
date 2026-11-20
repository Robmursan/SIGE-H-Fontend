# SIGE-H — Guion de Demostración Ejecutiva (22 de Noviembre de 2026) y Lista de Comprobación

**Aplicación:** `SIGE-H-Frontend` (Angular 22 Standalone · Fase `F4-E1`)  
**Audiencia objetivo:** Dirección de Enfermería, Jefaturas de División, Supervisión de Turno y Dirección Técnica.

---

## 1. Lista de Comprobación Previa a la Presentación (T-30 minutos)

- [ ] **Verificar repositorio y contrato OpenAPI:**
  ```bash
  npm run validate:openapi
  # Esperado: PASS · SHA-256 315c958c5d46fbdf7e6bee830d207be71b1ca0d137b74be456c300e4f05b4fdc · 19 operaciones
  ```
- [ ] **Verificar build y pruebas unitarias + E2E de interfaz con mocks:**
  ```bash
  npm run build
  npx ng test --watch=false
  npm run e2e:mock
  ```
- [ ] **Confirmar modo seguro de arranque:** Abrir `http://localhost:4200` (`npm start`) y comprobar que la aplicación inicia en **`SYNTHETIC_DEMO`** (`iamEnabled = false`), sin errores en consola y con `localStorage` / `sessionStorage` vacíos.
- [ ] **Si se incluye segmento en vivo contra QA temporal (F4-E2):**
  - Confirmar con el equipo backend que la instancia temporal NestJS está escuchando en `http://127.0.0.1:3000` con `IAM_V2_ENABLED=true` y `L3A_READS_ENABLED=true`.
  - Confirmar que el usuario sintético QA cuenta con asignación explícita `(hospitalId, servicioId)` en `/api/v1/auth/me` y datos sintéticos vigentes para la fecha/ventana de 168 h.
  - Verificar en la pestaña Network que todas las peticiones salen hacia `/api/v1/*` en mismo origen (proxy `proxy.conf.json`), sin errores CORS.
- [ ] **Plan B inmediato:** Si la instancia QA temporal no está disponible (`HTTP 503`), hacer clic en **Restaurar Modo Demo Seguro** en `/login` para continuar toda la presentación ejecutiva con los 4 módulos sintéticos de alta fidelidad.

---

## 2. Guion de Demostración Ejecutiva (Duración sugerida: 10–12 minutos)

### Bloque A — Visión Ejecutiva y Separación de Datos (2 min) — Modo `SYNTHETIC_DEMO`
1. **Pantalla inicial (`/dashboard`):** Mostrar el Tablero Ejecutivo de Enfermería en modo demostrativo seguro (identificado explícitamente con el banner `DEMOSTRACIÓN SINTÉTICA` y la etiqueta `MODO DEMO SINTÉTICO` en encabezado).
2. Destacar los cuatro módulos navegables (Tablero, Organización, Personal y Programación), el diseño responsive para supervisión en escritorio/móvil y el manejo de estados (`Cargando`, `Vacío`, `Error`, `Acceso Denegado 403`).

### Bloque B — Seguridad IAM V2 y Contexto Hospitalario Autorizado (3 min) — Modo `Integración QA (Opt-In)`
3. **Ir a `/login` (`Sesión IAM V2`):** Explicar que IAM y las lecturas reales permanecen deshabilitados por defecto y que se activan **explícitamente solo en memoria RAM** pulsando **«Activar Integración QA (IAM + API v1)»**.
4. **Demostrar protección de rutas (`iamAuthGuard`):** Intentar abrir `/personal` sin autenticar → el sistema redirige automáticamente a `/login?returnUrl=%2Fpersonal`.
5. **Iniciar sesión (`POST /api/v1/auth/login` → `GET /api/v1/auth/me`):**
   - Mostrar que los tokens residen **exclusivamente en memoria RAM** (verificar DevTools Application → `localStorage` y `sessionStorage` vacíos) y jamás se muestran en pantalla.
   - Mostrar el **Selector de Contexto Hospitalario Autorizado** derivado únicamente de `/auth/me` (sin otorgar `CATALOGOS_ADMINISTRAR` a usuarios de consulta).

### Bloque C — Recorrido Funcional L3B-2A (4 min)
6. **Personal y Adscripciones (`/personal`):**
   - Mostrar el padrón vigente (`GET /api/v1/empleados`) con filtros de hospital autorizado, `servicioId`, `fecha` y paginación por cursor, destacando que **no se expone RUD ni expediente completo**.
   - Seleccionar un empleado para abrir el detalle mínimo (`GET /api/v1/empleados/{empleadoId}`) y consultar las **Adscripciones por Contrato** (`GET /api/v1/contratos/{contratoId}/adscripciones`).
7. **Programación Laboral (`/programacion`):**
   - Consultar jornadas (`GET /api/v1/programaciones`) con presets rápidos de ventana (`24 h` / `168 h` con zona/offset ISO-8601) y paginación por cursor.
   - Señalar que las alertas de cobertura e incidencias se muestran como **no disponibles en modo real** hasta completar sus privilegios SQL en backend (cero simulación engañosa).
8. **Tablero de Coordinación (`/dashboard`):**
   - Mostrar los 7 indicadores reales (`GET /api/v1/tableros/coordinacion`): `jornadas`, `empleadosProgramados`, `programadas`, `cerradas`, `sustituidas`, `canceladas` y `horasPersonaProgramadas`.
   - Subrayar el banner semántico **`PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA`** y los bloques transparentes de **No disponible en modo real** para asistencia efectiva, cobertura realizada e incidencias verificadas.

### Bloque D — Cierre de Sesión, Limpieza y Retorno Seguro (1–2 min)
9. Pulsar **«Cerrar sesión»** en el encabezado (`POST /api/v1/auth/logout`): comprobar limpieza total de memoria RAM y retorno inmediato a `/login`.
10. Pulsar **«Restaurar Modo Demo Seguro»** para dejar la aplicación nuevamente en `SYNTHETIC_DEMO` con `iamEnabled = false`.
