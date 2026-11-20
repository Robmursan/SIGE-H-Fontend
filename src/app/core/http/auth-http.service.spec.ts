import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ProfileDto, SessionDto, TokensDto } from '../contracts/openapi-dtos.contract';
import { EphemeralSessionTokenStore } from '../security/ephemeral-session-token.store';
import { AuthHttpService } from './auth-http.service';
import { NormalizedHttpError } from './http-error-normalizer';

const SESSION_UUID = '11111111-1111-4111-8111-111111111111';
const USER_UUID = '22222222-2222-4222-8222-222222222222';
const HOSP_UUID = '33333333-3333-4333-8333-333333333333';
const SRV_UUID = '44444444-4444-4444-8444-444444444444';
const REFRESH_TOKEN_64 = 'r'.repeat(64);

describe('AuthHttpService (F4-B Contractual IAM V2)', () => {
  let service: AuthHttpService;
  let tokenStore: EphemeralSessionTokenStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthHttpService);
    tokenStore = TestBed.inject(EphemeralSessionTokenStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should execute all 6 contractual IAM V2 operations with exact OpenAPI paths and headers', async () => {
    // Asegurar que login/refresh jamás envían Authorization aunque haya token previo en RAM
    tokenStore.setEphemeralAccessToken('stale-token');

    const loginPromise = firstValueFrom(
      service.login({ identificador: 'cuenta_ficticia', password: 'demo-password' }),
    );
    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.headers.has('Authorization')).toBe(false);
    expect(loginReq.request.body).toEqual({
      identificador: 'cuenta_ficticia',
      password: 'demo-password',
    });

    const tokens: TokensDto = {
      accessToken: 'fresh-access-token',
      refreshToken: REFRESH_TOKEN_64,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    };
    loginReq.flush(tokens);
    expect(await loginPromise).toEqual(tokens);

    tokenStore.setSessionTokens(tokens);

    // GET /api/v1/auth/me
    const mePromise = firstValueFrom(service.me());
    const meReq = httpMock.expectOne('/api/v1/auth/me');
    expect(meReq.request.method).toBe('GET');
    expect(meReq.request.headers.get('Authorization')).toBe('Bearer fresh-access-token');

    const profile: ProfileDto = {
      usuarioId: USER_UUID,
      sessionId: SESSION_UUID,
      provider: 'local',
      assignments: [
        {
          kind: 'TITULAR',
          scope: { hospitalId: HOSP_UUID, divisionId: null, servicioId: SRV_UUID },
          permissions: ['PERSONAL_LEER'],
        },
      ],
    };
    meReq.flush(profile);
    expect(await mePromise).toEqual(profile);

    // POST /api/v1/auth/refresh
    const refreshPromise = firstValueFrom(service.refresh({ refreshToken: REFRESH_TOKEN_64 }));
    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    expect(refreshReq.request.method).toBe('POST');
    expect(refreshReq.request.headers.has('Authorization')).toBe(false);
    refreshReq.flush({ ...tokens, accessToken: 'rotated-access-token' });
    expect((await refreshPromise).accessToken).toBe('rotated-access-token');

    // GET /api/v1/auth/sessions
    const sessionsPromise = firstValueFrom(service.listSessions());
    const sessionsReq = httpMock.expectOne('/api/v1/auth/sessions');
    expect(sessionsReq.request.method).toBe('GET');
    const sessions: SessionDto[] = [
      {
        sessionId: SESSION_UUID,
        createdAt: '2026-11-18T20:00:00.000Z',
        expiresAt: '2026-11-19T20:00:00.000Z',
        idleExpiresAt: '2026-11-18T22:00:00.000Z',
        revokedAt: null,
        current: true,
      },
    ];
    sessionsReq.flush(sessions);
    expect(await sessionsPromise).toEqual(sessions);

    // DELETE /api/v1/auth/sessions/{sessionId} -> 204
    const revokePromise = firstValueFrom(service.revokeSession(SESSION_UUID));
    const revokeReq = httpMock.expectOne(`/api/v1/auth/sessions/${SESSION_UUID}`);
    expect(revokeReq.request.method).toBe('DELETE');
    revokeReq.flush(null, { status: 204, statusText: 'No Content' });
    expect(await revokePromise).toBeUndefined();

    // POST /api/v1/auth/logout -> 204
    const logoutPromise = firstValueFrom(service.logout());
    const logoutReq = httpMock.expectOne('/api/v1/auth/logout');
    expect(logoutReq.request.method).toBe('POST');
    logoutReq.flush(null, { status: 204, statusText: 'No Content' });
    expect(await logoutPromise).toBeUndefined();
  });

  it('should handle IAM 429 special format (IamRateLimitErrorDto without error field), 400, 401, 404 and 503', async () => {
    // 429 IamRateLimitErrorDto + Retry-After
    const login429 = firstValueFrom(
      service.login({ identificador: 'u', password: 'p' }),
    ).catch((e: NormalizedHttpError) => e);
    const req429 = httpMock.expectOne('/api/v1/auth/login');
    req429.flush(
      {
        statusCode: 429,
        message: 'Límite persistente de intentos alcanzado para este identificador.',
      },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '60' },
      },
    );
    const err429 = (await login429) as NormalizedHttpError;
    expect(err429.status).toBe(429);
    expect(err429.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err429.isIamRateLimitFormat).toBe(true);
    expect(err429.retryAfterSeconds).toBe(60);
    expect(err429.message).toContain('Límite persistente de intentos');

    // 503 IAM disabled by default
    const login503 = firstValueFrom(
      service.login({ identificador: 'u', password: 'p' }),
    ).catch((e: NormalizedHttpError) => e);
    const req503 = httpMock.expectOne('/api/v1/auth/login');
    req503.flush(
      { statusCode: 503, message: 'IAM disabled by default', error: 'Service Unavailable' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    const err503 = (await login503) as NormalizedHttpError;
    expect(err503.status).toBe(503);
    expect(err503.code).toBe('SERVICE_DISABLED_OR_UNAVAILABLE');

    // 400 invalid UUID in revokeSession prevented before HTTP dispatch
    const invalidUuidErr = (await firstValueFrom(
      service.revokeSession('not-a-uuid'),
    ).catch((e: NormalizedHttpError) => e)) as NormalizedHttpError;
    expect(invalidUuidErr.status).toBe(400);
    expect(invalidUuidErr.code).toBe('BAD_REQUEST_VALIDATION');

    // 404 session belonging to another user
    const revoke404 = firstValueFrom(service.revokeSession(SESSION_UUID)).catch(
      (e: NormalizedHttpError) => e,
    );
    const req404 = httpMock.expectOne(`/api/v1/auth/sessions/${SESSION_UUID}`);
    req404.flush(
      { statusCode: 404, message: 'Sesión no disponible', error: 'Not Found' },
      { status: 404, statusText: 'Not Found' },
    );
    const err404 = (await revoke404) as NormalizedHttpError;
    expect(err404.status).toBe(404);
    expect(err404.code).toBe('RESOURCE_NOT_FOUND');
  });
});
