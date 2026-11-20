import { inject, Injectable } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, takeUntil, throwError } from 'rxjs';
import { AuthHttpService } from '../http/auth-http.service';
import { NormalizedHttpError } from '../http/http-error-normalizer';
import { EphemeralSessionTokenStore } from './ephemeral-session-token.store';

/**
 * Coordinador single-flight para la rotación de `refreshToken` IAM V2 (F4-B).
 *
 * Garantías de seguridad:
 * - Si N solicitudes reciben HTTP 401 simultáneamente, se ejecuta exactamente UNA
 *   llamada `POST /api/v1/auth/refresh` compartida mediante `shareReplay(1)`.
 * - Si una solicitud rezagada recibe 401 con un `accessToken` ya reemplazado en la
 *   misma época de sesión, reutiliza el token nuevo sin disparar un segundo refresh
 *   (evita replay y revocación de familia).
 * - Si ocurre cierre de sesión, cambio de usuario o revocación mientras un refresh está
 *   en vuelo, se cancela (`takeUntil(sessionCleared$)`) y jamás sobrescribe la sesión nueva.
 */
@Injectable({ providedIn: 'root' })
export class AuthRefreshCoordinatorService {
  private readonly authHttp = inject(AuthHttpService);
  private readonly tokenStore = inject(EphemeralSessionTokenStore);

  private inFlightRefresh$: Observable<string> | null = null;
  private inFlightEpoch: number | null = null;

  public refreshAccessTokenSingleFlight(failedAccessToken: string | null): Observable<string> {
    const startEpoch = this.tokenStore.getSessionEpoch();

    // 1. Si otra solicitud en la misma época ya rotó el accessToken, reutilizarlo sin replay.
    const currentAccessToken = this.tokenStore.getEphemeralAccessToken();
    if (
      currentAccessToken &&
      failedAccessToken &&
      currentAccessToken !== failedAccessToken &&
      this.inFlightRefresh$ === null
    ) {
      return of(currentAccessToken);
    }

    // 2. Si ya hay una renovación en vuelo para esta misma época de sesión, compartirla.
    if (this.inFlightRefresh$ !== null && this.inFlightEpoch === startEpoch) {
      return this.inFlightRefresh$;
    }

    // 3. Iniciar una única renovación usando el refreshToken en memoria RAM.
    const refreshToken = this.tokenStore.getEphemeralRefreshToken();
    if (!refreshToken) {
      this.tokenStore.clearSessionMemory('revoked');
      const missingRefreshErr: NormalizedHttpError = {
        status: 401,
        code: 'UNAUTHORIZED_SESSION',
        title: 'Sesión Expirada Sin Token de Renovación (HTTP 401)',
        message: 'No existe un refreshToken activo en memoria para renovar la sesión.',
        timestampIso: new Date().toISOString(),
      };
      return throwError(() => missingRefreshErr);
    }

    this.tokenStore.markRefreshing();

    const refresh$ = this.authHttp.refresh({ refreshToken }).pipe(
      takeUntil(this.tokenStore.explicitLogout$),
      map((tokens) => {
        if (this.tokenStore.getSessionEpoch() !== startEpoch) {
          throw {
            status: 401,
            code: 'UNAUTHORIZED_SESSION',
            title: 'Sesión Invalidada Durante Renovación',
            message: 'La sesión fue cerrada o reemplazada mientras se renovaba el token.',
            timestampIso: new Date().toISOString(),
          } satisfies NormalizedHttpError;
        }
        this.tokenStore.setSessionTokens(tokens);
        return tokens.accessToken;
      }),
      catchError((err: unknown) => {
        if (this.tokenStore.getSessionEpoch() === startEpoch) {
          this.tokenStore.clearSessionMemory('revoked');
        }
        return throwError(() => err);
      }),
      finalize(() => {
        if (this.inFlightEpoch === startEpoch) {
          this.inFlightRefresh$ = null;
          this.inFlightEpoch = null;
        }
      }),
      shareReplay(1),
    );

    this.inFlightRefresh$ = refresh$;
    this.inFlightEpoch = startEpoch;
    return refresh$;
  }

  public isRefreshInFlight(): boolean {
    return this.inFlightRefresh$ !== null;
  }
}
