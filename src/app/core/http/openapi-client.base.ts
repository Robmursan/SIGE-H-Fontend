import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { SIGEH_RUNTIME_CONFIG } from '../config/environment.config';
import { EphemeralSessionTokenStore } from '../security/ephemeral-session-token.store';
import {
  NormalizedHttpError,
  normalizeOpenApiHttpError,
} from './http-error-normalizer';

export type { NormalizedHttpError } from './http-error-normalizer';

export interface OpenApiRequestOptions {
  readonly queryParams?: Readonly<Record<string, string | number | boolean | undefined | null>>;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Servicio base tipado preparado para consumir especificaciones OpenAPI (F3-A).
 *
 * Características:
 * - No inventa endpoints reales y bloquea el despacho si `openApiBaseUrl` es `null`.
 * - Manejo uniforme de errores HTTP 401, 403, 404, 409, 500 y red mediante `normalizeOpenApiHttpError`.
 * - Seguridad de sesión: jamás lee ni escribe tokens en `localStorage` o `sessionStorage`;
 *   consulta únicamente `EphemeralSessionTokenStore` en memoria volátil.
 */
@Injectable({ providedIn: 'root' })
export class OpenApiClientBaseService {
  protected readonly http = inject(HttpClient);
  protected readonly runtimeConfig = inject(SIGEH_RUNTIME_CONFIG);
  protected readonly tokenStore = inject(EphemeralSessionTokenStore);

  public isConfigured(): boolean {
    return Boolean(
      this.runtimeConfig.openApiBaseUrl && this.runtimeConfig.openApiBaseUrl.trim().length > 0,
    );
  }

  public getTyped<TResponse>(
    operationContractPath: string,
    options?: OpenApiRequestOptions,
  ): Observable<TResponse> {
    const baseUrl = this.runtimeConfig.openApiBaseUrl;
    if (!baseUrl) {
      const unconfiguredError: NormalizedHttpError = {
        status: 0,
        code: 'OPENAPI_NOT_CONFIGURED',
        title: 'Contrato OpenAPI Pendiente de Enlace',
        message:
          'El cliente HTTP tipado está preparado para OpenAPI, pero la URL base del backend no está habilitada en modo demostración sintética.',
        timestampIso: new Date().toISOString(),
      };
      return throwError(() => unconfiguredError);
    }

    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = operationContractPath.startsWith('/')
      ? operationContractPath
      : `/${operationContractPath}`;

    const params = this.buildHttpParams(options?.queryParams);
    const headers = this.buildHttpHeaders(options?.headers);

    return this.http
      .get<TResponse>(`${normalizedBase}${normalizedPath}`, { params, headers })
      .pipe(catchError((err: unknown) => throwError(() => normalizeOpenApiHttpError(err))));
  }

  public buildHttpParams(
    rawParams?: Readonly<Record<string, string | number | boolean | undefined | null>>,
  ): HttpParams {
    let params = new HttpParams();
    if (!rawParams) {
      return params;
    }

    for (const [key, value] of Object.entries(rawParams)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  private buildHttpHeaders(rawHeaders?: Readonly<Record<string, string>>): HttpHeaders {
    let headers = new HttpHeaders({
      Accept: 'application/json',
      'X-SIGEH-Client-Phase': this.runtimeConfig.phase,
    });

    const ephemeralToken = this.tokenStore.getEphemeralAccessToken();
    if (ephemeralToken) {
      headers = headers.set('Authorization', `Bearer ${ephemeralToken}`);
    }

    if (!rawHeaders) {
      return headers;
    }

    for (const [key, value] of Object.entries(rawHeaders)) {
      headers = headers.set(key, value);
    }
    return headers;
  }
}
