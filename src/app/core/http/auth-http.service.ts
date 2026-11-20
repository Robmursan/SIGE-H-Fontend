import { inject, Injectable } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';
import {
  LoginDto,
  ProfileDto,
  RefreshDto,
  SessionDto,
  TokensDto,
} from '../contracts/openapi-dtos.contract';
import {
  createNoRefreshAuthContext,
  createPublicAuthContext,
} from './auth-http.context';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';
import { isValidUuid } from './organization-http.service';

/**
 * Cliente HTTP contractual IAM V2 (`contracts/sigeh-v1.json` — F4-B).
 *
 * Operaciones verificadas implementadas:
 * - `POST /api/v1/auth/login` (`iamLogin`)
 * - `POST /api/v1/auth/refresh` (`iamRefresh`)
 * - `GET /api/v1/auth/me` (`iamMe`)
 * - `POST /api/v1/auth/logout` (`iamLogout`)
 * - `GET /api/v1/auth/sessions` (`iamSessions`)
 * - `DELETE /api/v1/auth/sessions/{sessionId}` (`iamRevokeSession`)
 *
 * No almacena credenciales en Web Storage ni registra contraseñas o tokens en logs/URLs.
 */
@Injectable({ providedIn: 'root' })
export class AuthHttpService {
  private readonly openApiClient = inject(OpenApiClientBaseService);

  /**
   * OperationId: `iamLogin` (`POST /api/v1/auth/login`)
   */
  public login(payload: LoginDto): Observable<TokensDto> {
    return this.openApiClient.postTyped<LoginDto, TokensDto>('/api/v1/auth/login', payload, {
      skipAuthHeader: true,
      context: createPublicAuthContext(),
    });
  }

  /**
   * OperationId: `iamRefresh` (`POST /api/v1/auth/refresh`)
   */
  public refresh(payload: RefreshDto): Observable<TokensDto> {
    return this.openApiClient.postTyped<RefreshDto, TokensDto>('/api/v1/auth/refresh', payload, {
      skipAuthHeader: true,
      context: createPublicAuthContext(),
    });
  }

  /**
   * OperationId: `iamMe` (`GET /api/v1/auth/me`)
   */
  public me(): Observable<ProfileDto> {
    return this.openApiClient.getTyped<ProfileDto>('/api/v1/auth/me');
  }

  /**
   * OperationId: `iamLogout` (`POST /api/v1/auth/logout`)
   * Respuesta contractual exitosa: HTTP 204 sin cuerpo.
   */
  public logout(): Observable<void> {
    return this.openApiClient
      .postTyped<Record<string, never>, unknown>(
        '/api/v1/auth/logout',
        {},
        {
          context: createNoRefreshAuthContext(),
        },
      )
      .pipe(map(() => undefined));
  }

  /**
   * OperationId: `iamSessions` (`GET /api/v1/auth/sessions`)
   */
  public listSessions(): Observable<readonly SessionDto[]> {
    return this.openApiClient.getTyped<readonly SessionDto[]>('/api/v1/auth/sessions');
  }

  /**
   * OperationId: `iamRevokeSession` (`DELETE /api/v1/auth/sessions/{sessionId}`)
   * Respuesta contractual exitosa: HTTP 204 sin cuerpo.
   */
  public revokeSession(sessionId: string): Observable<void> {
    if (!isValidUuid(sessionId)) {
      const invalidUuidError: NormalizedHttpError = {
        status: 400,
        code: 'BAD_REQUEST_VALIDATION',
        title: 'Identificador de Sesión Inválido (HTTP 400)',
        message: 'El parámetro sessionId debe ser un UUID válido según el contrato IAM v1.',
        timestampIso: new Date().toISOString(),
      };
      return throwError(() => invalidUuidError);
    }

    const encodedId = encodeURIComponent(sessionId.trim());
    return this.openApiClient
      .deleteTyped<unknown>(`/api/v1/auth/sessions/${encodedId}`)
      .pipe(map(() => undefined));
  }
}
