import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, takeUntil, throwError } from 'rxjs';
import { AuthRefreshCoordinatorService } from '../security/auth-refresh-coordinator.service';
import { EphemeralSessionTokenStore } from '../security/ephemeral-session-token.store';
import {
  RETRIED_AFTER_AUTH_REFRESH,
  SKIP_AUTH_HEADER,
  SKIP_AUTH_REFRESH,
} from './auth-http.context';

const AUTH_NO_REFRESH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
] as const;

const AUTH_NO_HEADER_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh'] as const;

function matchesAnyPath(url: string, patterns: readonly string[]): boolean {
  const pathOnly = url.split('?')[0];
  return patterns.some((pattern) => pathOnly.endsWith(pattern));
}

function extractBearerToken(req: HttpRequest<unknown>): string | null {
  const header = req.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Interceptor HTTP IAM V2 con renovación single-flight (F4-B).
 *
 * Reglas de seguridad:
 * - Adjunta `Authorization: Bearer <accessToken>` desde memoria RAM en solicitudes protegidas.
 * - Nunca adjunta Bearer ni renueva sobre `/auth/login` o `/auth/refresh`.
 * - Nunca renueva sobre `/auth/logout` ni sobre solicitudes ya reintentadas (evita bucles).
 * - Si varias solicitudes reciben `401` simultáneamente, todas comparten una única llamada
 *   `POST /api/v1/auth/refresh` a través de `AuthRefreshCoordinatorService`.
 * - Cancela solicitudes protegidas pendientes cuando se limpia/revoca la sesión (`sessionCleared$`).
 */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStore = inject(EphemeralSessionTokenStore);
  const refreshCoordinator = inject(AuthRefreshCoordinatorService);

  const skipHeader =
    req.context.get(SKIP_AUTH_HEADER) || matchesAnyPath(req.url, AUTH_NO_HEADER_PATHS);
  const skipRefresh =
    req.context.get(SKIP_AUTH_REFRESH) || matchesAnyPath(req.url, AUTH_NO_REFRESH_PATHS);
  const alreadyRetried = req.context.get(RETRIED_AFTER_AUTH_REFRESH);

  let outgoingReq = req;
  const currentToken = tokenStore.getEphemeralAccessToken();
  if (!skipHeader && currentToken && !req.headers.has('Authorization')) {
    outgoingReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${currentToken}`,
      },
    });
  }

  const usedAccessToken = extractBearerToken(outgoingReq);
  const hadSessionAtDispatch = usedAccessToken !== null;
  const dispatchEpoch = tokenStore.getSessionEpoch();

  const dispatch$ =
    hadSessionAtDispatch && !skipRefresh
      ? next(outgoingReq).pipe(takeUntil(tokenStore.sessionCleared$))
      : next(outgoingReq);

  return dispatch$.pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        skipRefresh
      ) {
        return throwError(() => error);
      }

      // Evitar bucle infinito si el reintento post-refresh vuelve a recibir 401
      if (alreadyRetried) {
        if (tokenStore.getSessionEpoch() === dispatchEpoch) {
          tokenStore.clearSessionMemory('revoked');
        }
        return throwError(() => error);
      }

      // Si no hay refreshToken en memoria (sesión anónima o ya limpia), propagar 401
      if (!tokenStore.hasRefreshToken()) {
        if (hadSessionAtDispatch && tokenStore.getSessionEpoch() === dispatchEpoch) {
          tokenStore.clearSessionMemory('revoked');
        }
        return throwError(() => error);
      }

      return refreshCoordinator.refreshAccessTokenSingleFlight(usedAccessToken).pipe(
        switchMap((freshAccessToken) => {
          const retriedReq = outgoingReq.clone({
            setHeaders: {
              Authorization: `Bearer ${freshAccessToken}`,
            },
            context: outgoingReq.context.set(RETRIED_AFTER_AUTH_REFRESH, true),
          });
          return next(retriedReq).pipe(
            takeUntil(tokenStore.sessionCleared$),
            catchError((retryErr: unknown) => {
              if (
                retryErr instanceof HttpErrorResponse &&
                retryErr.status === 401 &&
                tokenStore.getSessionEpoch() === dispatchEpoch
              ) {
                tokenStore.clearSessionMemory('revoked');
              }
              return throwError(() => retryErr);
            }),
          );
        }),
      );
    }),
  );
};
