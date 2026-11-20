import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
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
  readonly context?: HttpContext;
  readonly skipAuthHeader?: boolean;
}

/**
 * Servicio base tipado preparado para consumir especificaciones OpenAPI (F3-A / F4-A / F4-B).
 *
 * Características:
 * - `openApiBaseUrl = ''`: origen actual (mismo origen vía proxy `/api` en desarrollo).
 * - `openApiBaseUrl = null`: bloquea el despacho con `OPENAPI_NOT_CONFIGURED`.
 * - Manejo uniforme de errores HTTP 400, 401, 403, 404, 409, 429 (IAM), 500, 503 y red.
 * - Seguridad de sesión: jamás lee ni escribe tokens en `localStorage` o `sessionStorage`;
 *   consulta únicamente `EphemeralSessionTokenStore` en memoria volátil.
 */
@Injectable({ providedIn: 'root' })
export class OpenApiClientBaseService {
  protected readonly http = inject(HttpClient);
  protected readonly runtimeConfig = inject(SIGEH_RUNTIME_CONFIG);
  protected readonly tokenStore = inject(EphemeralSessionTokenStore);

  public isConfigured(): boolean {
    return this.runtimeConfig.openApiBaseUrl !== null;
  }

  public getTyped<TResponse>(
    operationContractPath: string,
    options?: OpenApiRequestOptions,
  ): Observable<TResponse> {
    const resolvedUrl = this.resolveUrlOrError(operationContractPath);
    if (typeof resolvedUrl !== 'string') {
      return throwError(() => resolvedUrl);
    }

    const params = this.buildHttpParams(options?.queryParams);
    const headers = this.buildHttpHeaders(options?.headers, options?.skipAuthHeader);

    return this.http
      .get<TResponse>(resolvedUrl, { params, headers, context: options?.context })
      .pipe(catchError((err: unknown) => throwError(() => normalizeOpenApiHttpError(err))));
  }

  public postTyped<TBody, TResponse>(
    operationContractPath: string,
    body: TBody,
    options?: OpenApiRequestOptions,
  ): Observable<TResponse> {
    const resolvedUrl = this.resolveUrlOrError(operationContractPath);
    if (typeof resolvedUrl !== 'string') {
      return throwError(() => resolvedUrl);
    }

    const params = this.buildHttpParams(options?.queryParams);
    const headers = this.buildHttpHeaders(options?.headers, options?.skipAuthHeader);

    return this.http
      .post<TResponse>(resolvedUrl, body, { params, headers, context: options?.context })
      .pipe(catchError((err: unknown) => throwError(() => normalizeOpenApiHttpError(err))));
  }

  public deleteTyped<TResponse>(
    operationContractPath: string,
    options?: OpenApiRequestOptions,
  ): Observable<TResponse> {
    const resolvedUrl = this.resolveUrlOrError(operationContractPath);
    if (typeof resolvedUrl !== 'string') {
      return throwError(() => resolvedUrl);
    }

    const params = this.buildHttpParams(options?.queryParams);
    const headers = this.buildHttpHeaders(options?.headers, options?.skipAuthHeader);

    return this.http
      .delete<TResponse>(resolvedUrl, { params, headers, context: options?.context })
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

  private resolveUrlOrError(operationContractPath: string): string | NormalizedHttpError {
    const baseUrl = this.runtimeConfig.openApiBaseUrl;
    if (baseUrl === null) {
      return {
        status: 0,
        code: 'OPENAPI_NOT_CONFIGURED',
        title: 'Contrato OpenAPI Pendiente de Enlace',
        message:
          'El cliente HTTP tipado está preparado para OpenAPI, pero la URL base del backend no está habilitada (openApiBaseUrl = null).',
        timestampIso: new Date().toISOString(),
      };
    }

    const trimmedBase = baseUrl.trim();
    const normalizedBase = trimmedBase.endsWith('/') ? trimmedBase.slice(0, -1) : trimmedBase;
    const normalizedPath = operationContractPath.startsWith('/')
      ? operationContractPath
      : `/${operationContractPath}`;

    return `${normalizedBase}${normalizedPath}`;
  }

  private buildHttpHeaders(
    rawHeaders?: Readonly<Record<string, string>>,
    skipAuthHeader = false,
  ): HttpHeaders {
    let headers = new HttpHeaders({
      Accept: 'application/json',
      'X-SIGEH-Client-Phase': this.runtimeConfig.phase,
    });

    if (!skipAuthHeader) {
      const ephemeralToken = this.tokenStore.getEphemeralAccessToken();
      if (ephemeralToken) {
        headers = headers.set('Authorization', `Bearer ${ephemeralToken}`);
      }
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
