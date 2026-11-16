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

Las pruebas QA usaron únicamente fixtures sintéticos, limpiados al final. Para una demostración persistente se necesita una preparación de datos/credenciales y activación temporal aprobadas; no hay usuarios administrativos predeterminados. El contrato queda en este repositorio para una transferencia controlada posterior, sin publicación ni cambios de AGY.
