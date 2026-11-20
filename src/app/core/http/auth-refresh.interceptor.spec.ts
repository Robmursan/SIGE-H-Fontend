import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TokensDto } from '../contracts/openapi-dtos.contract';
import { EphemeralSessionTokenStore } from '../security/ephemeral-session-token.store';
import { AuthHttpService } from './auth-http.service';
import { authRefreshInterceptor } from './auth-refresh.interceptor';
import { NormalizedHttpError } from './http-error-normalizer';

const SESSION_UUID = '11111111-1111-4111-8111-111111111111';
const INITIAL_REFRESH = 'a'.repeat(64);
const ROTATED_REFRESH = 'b'.repeat(64);

describe('authRefreshInterceptor (F4-B Single-Flight Refresh & Anti-Replay)', () => {
  let http: HttpClient;
  let authHttp: AuthHttpService;
  let tokenStore: EphemeralSessionTokenStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    authHttp = TestBed.inject(AuthHttpService);
    tokenStore = TestBed.inject(EphemeralSessionTokenStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should execute strictly ONE POST /api/v1/auth/refresh when 3 concurrent protected requests receive 401 and retry all 3 with the rotated token', async () => {
    tokenStore.setSessionTokens({
      accessToken: 'expired-access-token',
      refreshToken: INITIAL_REFRESH,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    });

    const p1 = firstValueFrom(authHttp.me());
    const p2 = firstValueFrom(authHttp.listSessions());
    const p3 = firstValueFrom(http.get<{ ok: boolean }>('/api/v1/hospitales'));

    // Todas salen con el token expirado inicial
    const req1 = httpMock.expectOne('/api/v1/auth/me');
    const req2 = httpMock.expectOne('/api/v1/auth/sessions');
    const req3 = httpMock.expectOne('/api/v1/hospitales');
    expect(req1.request.headers.get('Authorization')).toBe('Bearer expired-access-token');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer expired-access-token');
    expect(req3.request.headers.get('Authorization')).toBe('Bearer expired-access-token');

    // Las 3 fallan con 401 simultáneamente
    req1.flush({ statusCode: 401, message: 'Expired', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    req2.flush({ statusCode: 401, message: 'Expired', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    req3.flush({ statusCode: 401, message: 'Expired', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Debe haberse despachado EXACTAMENTE UNA llamada a /api/v1/auth/refresh
    const refreshCalls = httpMock.match('/api/v1/auth/refresh');
    expect(refreshCalls.length).toBe(1);
    expect(refreshCalls[0].request.method).toBe('POST');
    expect(refreshCalls[0].request.headers.has('Authorization')).toBe(false);
    expect(refreshCalls[0].request.body).toEqual({ refreshToken: INITIAL_REFRESH });

    const rotatedTokens: TokensDto = {
      accessToken: 'fresh-rotated-access-token',
      refreshToken: ROTATED_REFRESH,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    };
    refreshCalls[0].flush(rotatedTokens);

    // Las 3 solicitudes originales se reintentan automáticamente con el nuevo Bearer token
    const retry1 = httpMock.expectOne('/api/v1/auth/me');
    const retry2 = httpMock.expectOne('/api/v1/auth/sessions');
    const retry3 = httpMock.expectOne('/api/v1/hospitales');

    expect(retry1.request.headers.get('Authorization')).toBe('Bearer fresh-rotated-access-token');
    expect(retry2.request.headers.get('Authorization')).toBe('Bearer fresh-rotated-access-token');
    expect(retry3.request.headers.get('Authorization')).toBe('Bearer fresh-rotated-access-token');

    retry1.flush({ usuarioId: SESSION_UUID, sessionId: SESSION_UUID, provider: 'local', assignments: [] });
    retry2.flush([]);
    retry3.flush({ ok: true });

    const [res1, res2, res3] = await Promise.all([p1, p2, p3]);
    expect(res1.sessionId).toBe(SESSION_UUID);
    expect(res2).toEqual([]);
    expect(res3).toEqual({ ok: true });
    expect(tokenStore.getEphemeralRefreshToken()).toBe(ROTATED_REFRESH);
  });

  it('should NEVER trigger refresh on /auth/login, /auth/refresh or /auth/logout 401 responses', async () => {
    tokenStore.setSessionTokens({
      accessToken: 'active-token',
      refreshToken: INITIAL_REFRESH,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    });

    const loginErrPromise = firstValueFrom(
      authHttp.login({ identificador: 'x', password: 'bad' }),
    ).catch((e: NormalizedHttpError) => e);
    httpMock
      .expectOne('/api/v1/auth/login')
      .flush({ statusCode: 401, message: 'Bad credentials', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(((await loginErrPromise) as NormalizedHttpError).status).toBe(401);

    const refreshErrPromise = firstValueFrom(
      authHttp.refresh({ refreshToken: INITIAL_REFRESH }),
    ).catch((e: NormalizedHttpError) => e);
    httpMock
      .expectOne('/api/v1/auth/refresh')
      .flush({ statusCode: 401, message: 'Revoked', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(((await refreshErrPromise) as NormalizedHttpError).status).toBe(401);

    const logoutErrPromise = firstValueFrom(authHttp.logout()).catch(
      (e: NormalizedHttpError) => e,
    );
    httpMock
      .expectOne('/api/v1/auth/logout')
      .flush({ statusCode: 401, message: 'Invalid session', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(((await logoutErrPromise) as NormalizedHttpError).status).toBe(401);

    // Confirmar cero llamadas extra a /auth/refresh
    expect(httpMock.match('/api/v1/auth/refresh').length).toBe(0);
  });

  it('should wipe memory and prevent infinite loops if refresh fails or if the retried request returns 401 again', async () => {
    // Escenario A: Refresh falla con 401 (familia revocada)
    tokenStore.setSessionTokens({
      accessToken: 'old-access',
      refreshToken: INITIAL_REFRESH,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    });

    const pRevoked = firstValueFrom(authHttp.me()).catch((e: NormalizedHttpError) => e);
    httpMock
      .expectOne('/api/v1/auth/me')
      .flush({ statusCode: 401, message: 'Expired', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne('/api/v1/auth/refresh')
      .flush({ statusCode: 401, message: 'Refresh revoked', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const errA = (await pRevoked) as NormalizedHttpError;
    expect(errA.status).toBe(401);
    expect(tokenStore.getEphemeralAccessToken()).toBeNull();
    expect(tokenStore.getEphemeralRefreshToken()).toBeNull();
    expect(tokenStore.sessionStatus()).toBe('revoked');

    // Escenario B: Refresh tiene éxito pero el reintento vuelve a devolver 401 (no debe reintentar infinitamente)
    tokenStore.setSessionTokens({
      accessToken: 'old-access-2',
      refreshToken: INITIAL_REFRESH,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    });

    const pLoop = firstValueFrom(authHttp.me()).catch((e: NormalizedHttpError) => e);
    httpMock
      .expectOne('/api/v1/auth/me')
      .flush({ statusCode: 401, message: 'Expired', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/v1/auth/refresh').flush({
      accessToken: 'rotated-access-2',
      refreshToken: ROTATED_REFRESH,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    } satisfies TokensDto);
    httpMock
      .expectOne('/api/v1/auth/me')
      .flush({ statusCode: 401, message: 'Still unauthorized', error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const errB = (await pLoop) as NormalizedHttpError;
    expect(errB.status).toBe(401);
    expect(httpMock.match('/api/v1/auth/refresh').length).toBe(0);
    expect(tokenStore.getEphemeralAccessToken()).toBeNull();
    expect(tokenStore.sessionStatus()).toBe('revoked');
  });

  it('should cancel pending protected HTTP requests immediately when session is cleared (logout/user switch)', () => {
    tokenStore.setSessionTokens({
      accessToken: 'active-access',
      refreshToken: INITIAL_REFRESH,
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    });

    let completed = false;
    authHttp.me().subscribe({
      complete: () => {
        completed = true;
      },
    });

    const pendingReq = httpMock.expectOne('/api/v1/auth/me');
    expect(pendingReq.cancelled).toBe(false);

    tokenStore.clearSessionMemory('anonymous');

    expect(pendingReq.cancelled).toBe(true);
    expect(completed).toBe(true);
  });
});
