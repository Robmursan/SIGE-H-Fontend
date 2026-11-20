import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ProfileDto, TokensDto } from '../contracts/openapi-dtos.contract';
import { authRefreshInterceptor } from '../http/auth-refresh.interceptor';
import { AuthSessionService } from './auth-session.service';
import { EphemeralSessionTokenStore } from './ephemeral-session-token.store';

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';
const USER_A = '33333333-3333-4333-8333-333333333333';
const USER_B = '44444444-4444-4444-8444-444444444444';
const HOSP_1 = '55555555-5555-4555-8555-555555555555';
const HOSP_2 = '66666666-6666-4666-8666-666666666666';
const HOSP_UNAUTHORIZED = '99999999-9999-4999-8999-999999999999';
const DIV_1 = '77777777-7777-4777-8777-777777777777';
const SRV_1 = '88888888-8888-4888-8888-888888888888';
const SRV_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SRV_UNAUTHORIZED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('AuthSessionService (F4-B End-to-End IAM Journey & Authorized Context)', () => {
  let session: AuthSessionService;
  let tokenStore: EphemeralSessionTokenStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    session = TestBed.inject(AuthSessionService);
    tokenStore = TestBed.inject(EphemeralSessionTokenStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should complete full acceptance journey: login -> RAM session -> /auth/me -> authorized context -> 401 single-flight refresh -> logout & complete cleanup', async () => {
    // 0. Por defecto IAM está deshabilitado y no hay sesión
    expect(session.isIamEnabled()).toBe(false);
    expect(session.isAuthenticated()).toBe(false);

    // 1. Login -> almacenamiento en memoria RAM -> /auth/me
    const loginPromise = firstValueFrom(
      session.login({ identificador: 'jefa_turno_demo', password: 'secret-demo-password' }),
    );

    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    expect(loginReq.request.method).toBe('POST');
    const tokens1: TokensDto = {
      accessToken: 'access-v1',
      refreshToken: 'a'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_A,
    };
    loginReq.flush(tokens1);

    const meReq = httpMock.expectOne('/api/v1/auth/me');
    expect(meReq.request.headers.get('Authorization')).toBe('Bearer access-v1');
    const profileA: ProfileDto = {
      usuarioId: USER_A,
      sessionId: SESSION_A,
      provider: 'local',
      assignments: [
        {
          kind: 'TITULAR',
          scope: { hospitalId: HOSP_1, divisionId: DIV_1, servicioId: SRV_1 },
          permissions: ['PERSONAL_LEER', 'PROGRAMACION_LEER'],
        },
        {
          kind: 'ENCARGADO',
          scope: { hospitalId: HOSP_1, divisionId: DIV_1, servicioId: SRV_2 },
          permissions: ['PROGRAMACION_LEER'],
        },
      ],
    };
    meReq.flush(profileA);

    const loadedProfile = await loginPromise;
    expect(loadedProfile.usuarioId).toBe(USER_A);
    expect(session.isAuthenticated()).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    // 2. Contexto autorizado derivado estrictamente de /auth/me
    expect(session.authorizedHospitals().length).toBe(1);
    expect(session.selectedHospitalId()).toBe(HOSP_1);
    expect(session.selectedServiceId()).toBe(SRV_1);
    expect(session.hasPermissionInSelectedContext('PERSONAL_LEER')).toBe(true);
    expect(session.hasPermissionInSelectedContext('CATALOGOS_ADMINISTRAR')).toBe(false);

    // Selección válida dentro del ámbito
    expect(session.selectService(SRV_2)).toBe(true);
    expect(session.selectedServiceId()).toBe(SRV_2);

    // Rechazo estricto de hospital/servicio no autorizados
    expect(session.selectHospital(HOSP_UNAUTHORIZED)).toBe(false);
    expect(session.selectService(SRV_UNAUTHORIZED)).toBe(false);
    expect(session.selectedHospitalId()).toBe(HOSP_1);
    expect(session.selectedServiceId()).toBe(SRV_2);

    // 3. Renovación transparente ante 401 durante consulta protegida (`loadSessions`)
    const sessionsPromise = firstValueFrom(session.loadSessions());
    const sessionsReq1 = httpMock.expectOne('/api/v1/auth/sessions');
    expect(sessionsReq1.request.headers.get('Authorization')).toBe('Bearer access-v1');
    sessionsReq1.flush(
      { statusCode: 401, message: 'Access token expired', error: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    expect(refreshReq.request.body).toEqual({ refreshToken: 'a'.repeat(64) });
    refreshReq.flush({
      accessToken: 'access-v2',
      refreshToken: 'b'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_A,
    } satisfies TokensDto);

    const sessionsReq2 = httpMock.expectOne('/api/v1/auth/sessions');
    expect(sessionsReq2.request.headers.get('Authorization')).toBe('Bearer access-v2');
    sessionsReq2.flush([
      {
        sessionId: SESSION_A,
        createdAt: '2026-11-18T20:00:00.000Z',
        expiresAt: '2026-11-19T20:00:00.000Z',
        idleExpiresAt: '2026-11-18T22:00:00.000Z',
        revokedAt: null,
        current: true,
      },
    ]);

    const sessions = await sessionsPromise;
    expect(sessions.length).toBe(1);
    expect(tokenStore.getEphemeralAccessToken()).toBe('access-v2');

    // 4. Cierre de sesión y limpieza total de memoria RAM y estado reactivo
    const logoutPromise = firstValueFrom(session.logout());
    const logoutReq = httpMock.expectOne('/api/v1/auth/logout');
    expect(logoutReq.request.headers.get('Authorization')).toBe('Bearer access-v2');
    logoutReq.flush(null, { status: 204, statusText: 'No Content' });
    await logoutPromise;

    expect(session.isAuthenticated()).toBe(false);
    expect(session.profile()).toBeNull();
    expect(session.authorizedHospitals()).toEqual([]);
    expect(session.selectedHospitalId()).toBeNull();
    expect(session.selectedServiceId()).toBeNull();
    expect(session.sessions()).toEqual([]);
    expect(tokenStore.getEphemeralAccessToken()).toBeNull();
    expect(tokenStore.getEphemeralRefreshToken()).toBeNull();
    expect(tokenStore.getSessionId()).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('should document scope limitation without inventing servicioId when /auth/me only grants hospital/division mandate (servicioId = null)', async () => {
    const loginPromise = firstValueFrom(
      session.login({ identificador: 'jefa_division_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'access-broad',
      refreshToken: 'c'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_A,
    } satisfies TokensDto);
    httpMock.expectOne('/api/v1/auth/me').flush({
      usuarioId: USER_A,
      sessionId: SESSION_A,
      provider: 'local',
      assignments: [
        {
          kind: 'TITULAR',
          scope: { hospitalId: HOSP_2, divisionId: DIV_1, servicioId: null },
          permissions: ['PERSONAL_LEER'],
        },
      ],
    } satisfies ProfileDto);

    await loginPromise;

    expect(session.selectedHospitalId()).toBe(HOSP_2);
    expect(session.selectedServiceId()).toBeNull();
    expect(session.authorizedServicesForSelectedHospital()).toEqual([]);
    expect(session.scopeLimitationNotice()?.code).toBe(
      'SERVICE_ENUMERATION_UNAVAILABLE_WITHOUT_CATALOG',
    );
    expect(session.selectedContext()?.hasBroadScopeWithoutServiceEnumeration).toBe(true);
    expect(session.selectService(SRV_1)).toBe(false);
  });

  it('should wipe previous user state on user switch and on revoking current session', async () => {
    // Login Usuario A
    const pA = firstValueFrom(session.login({ identificador: 'user_a', password: 'p1' }));
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'token-a',
      refreshToken: 'd'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_A,
    } satisfies TokensDto);
    httpMock.expectOne('/api/v1/auth/me').flush({
      usuarioId: USER_A,
      sessionId: SESSION_A,
      provider: 'local',
      assignments: [{ kind: 'TITULAR', scope: { hospitalId: HOSP_1, servicioId: SRV_1 }, permissions: ['A'] }],
    } satisfies ProfileDto);
    await pA;

    // Cambio a Usuario B: debe purgar estado de Usuario A antes de emitir el nuevo login
    const pB = firstValueFrom(session.login({ identificador: 'user_b', password: 'p2' }));
    expect(session.profile()).toBeNull();
    expect(session.selectedHospitalId()).toBeNull();
    expect(tokenStore.getEphemeralAccessToken()).toBeNull();

    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'token-b',
      refreshToken: 'e'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_B,
    } satisfies TokensDto);
    httpMock.expectOne('/api/v1/auth/me').flush({
      usuarioId: USER_B,
      sessionId: SESSION_B,
      provider: 'local',
      assignments: [{ kind: 'ENCARGADO', scope: { hospitalId: HOSP_2, servicioId: SRV_2 }, permissions: ['B'] }],
    } satisfies ProfileDto);
    await pB;

    expect(session.profile()?.usuarioId).toBe(USER_B);
    expect(session.selectedHospitalId()).toBe(HOSP_2);
    expect(session.selectHospital(HOSP_1)).toBe(false);

    // Revocar sesión actual limpia toda la memoria local
    const revokePromise = firstValueFrom(session.revokeSession(SESSION_B));
    httpMock
      .expectOne(`/api/v1/auth/sessions/${SESSION_B}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await revokePromise;

    expect(session.isAuthenticated()).toBe(false);
    expect(session.profile()).toBeNull();
    expect(tokenStore.getEphemeralAccessToken()).toBeNull();
    expect(tokenStore.sessionStatus()).toBe('revoked');
  });
});
