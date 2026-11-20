import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Impide adjuntar `Authorization: Bearer` (p. ej. `/auth/login`, `/auth/refresh`).
 */
export const SKIP_AUTH_HEADER = new HttpContextToken<boolean>(() => false);

/**
 * Impide disparar renovación single-flight ante un HTTP 401 (p. ej. `/auth/login`,
 * `/auth/refresh`, `/auth/logout`). Evita bucles y replay de tokens.
 */
export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

/**
 * Marca interna para solicitudes reintentadas tras una rotación exitosa de token.
 * Garantiza un máximo de un reintento por solicitud para impedir bucles infinitos.
 */
export const RETRIED_AFTER_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

export function createPublicAuthContext(): HttpContext {
  return new HttpContext().set(SKIP_AUTH_HEADER, true).set(SKIP_AUTH_REFRESH, true);
}

export function createNoRefreshAuthContext(): HttpContext {
  return new HttpContext().set(SKIP_AUTH_REFRESH, true);
}
