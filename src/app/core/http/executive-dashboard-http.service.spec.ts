import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_SIGEH_RUNTIME_CONFIG,
  SIGEH_RUNTIME_CONFIG,
} from '../config/environment.config';
import {
  ProfileDto,
  ProgrammingDashboardDto,
  TokensDto,
} from '../contracts/openapi-dtos.contract';
import { AuthSessionService } from '../security/auth-session.service';
import { ExecutiveDashboardHttpService } from './executive-dashboard-http.service';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_UUID = '11111111-1111-4111-8111-111111111111';
const DIV_UUID = '22222222-2222-4222-8222-222222222222';
const SRV_UUID = '33333333-3333-4333-8333-333333333333';
const DESDE_ISO = '2026-11-16T00:00:00-06:00';
const HASTA_ISO = '2026-11-23T00:00:00-06:00';

describe('ExecutiveDashboardHttpService (F4-D GET /api/v1/tableros/coordinacion)', () => {
  it('should block HTTP traffic and return OPENAPI_NOT_CONFIGURED when openApiBaseUrl is null', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: { ...DEFAULT_SIGEH_RUNTIME_CONFIG, openApiBaseUrl: null },
        },
      ],
    });

    const service = TestBed.inject(ExecutiveDashboardHttpService);
    const httpMock = TestBed.inject(HttpTestingController);

    const result = await firstValueFrom(
      service.queryDashboard({
        hospitalId: HOSP_UUID,
        servicioId: SRV_UUID,
        desde: DESDE_ISO,
        hasta: HASTA_ISO,
      }),
    );

    expect(result.state).toBe('error');
    expect(result.error?.code).toBe('OPENAPI_NOT_CONFIGURED');
    httpMock.verify();
  });

  it('should consume GET /api/v1/tableros/coordinacion using authorized AuthSessionService context and preserve PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA semantics', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const service = TestBed.inject(ExecutiveDashboardHttpService);
    const authSession = TestBed.inject(AuthSessionService);
    const httpMock = TestBed.inject(HttpTestingController);

    // Autenticar contexto autorizado
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'coord_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'dash-token',
      refreshToken: 'a'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    } satisfies TokensDto);
    httpMock.expectOne('/api/v1/auth/me').flush({
      usuarioId: USER_UUID,
      sessionId: SESSION_UUID,
      provider: 'local',
      assignments: [
        {
          kind: 'TITULAR',
          scope: { hospitalId: HOSP_UUID, divisionId: DIV_UUID, servicioId: SRV_UUID },
          permissions: ['TABLERO_LEER'],
        },
      ],
    } satisfies ProfileDto);
    await loginPromise;

    const dashPromise = firstValueFrom(
      service.queryDashboard({
        desde: DESDE_ISO,
        hasta: HASTA_ISO,
      }),
    );

    const req = httpMock.expectOne((r) => r.url === '/api/v1/tableros/coordinacion');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-SIGEH-Client-Phase')).toBe('F4-F');
    expect(req.request.params.get('hospitalId')).toBe(HOSP_UUID);
    expect(req.request.params.get('servicioId')).toBe(SRV_UUID);
    expect(req.request.params.get('divisionId')).toBe(DIV_UUID);
    expect(req.request.params.get('desde')).toBe(DESDE_ISO);
    expect(req.request.params.get('hasta')).toBe(HASTA_ISO);

    req.flush({
      base: 'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA',
      jornadas: 28,
      empleadosProgramados: 12,
      programadas: 24,
      canceladas: 1,
      sustituidas: 2,
      cerradas: 1,
      horasPersonaProgramadas: 210,
    } satisfies ProgrammingDashboardDto);

    const res = await dashPromise;
    expect(res.state).toBe('ready');
    expect(res.snapshot?.metadata.isSyntheticDemo).toBe(false);
    expect(res.snapshot?.programmingIndicators?.base).toBe(
      'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA',
    );
    expect(res.snapshot?.programmingIndicators?.jornadas).toBe(28);
    expect(res.snapshot?.serviceCoverage).toEqual([]);
    expect(res.snapshot?.incidents).toEqual([]);
    httpMock.verify();
  });

  it('should reject >168h windows and normalize HTTP 400, 401, 403 and 503 responses', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const service = TestBed.inject(ExecutiveDashboardHttpService);
    const httpMock = TestBed.inject(HttpTestingController);

    // > 168 h rechazada antes de despachar HTTP
    const over168 = await firstValueFrom(
      service.queryDashboard({
        hospitalId: HOSP_UUID,
        servicioId: SRV_UUID,
        desde: '2026-11-16T00:00:00Z',
        hasta: '2026-11-25T00:00:00Z',
      }),
    );
    expect(over168.state).toBe('error');
    expect(over168.error?.code).toBe('BAD_REQUEST_VALIDATION');

    const baseCriteria = {
      hospitalId: HOSP_UUID,
      servicioId: SRV_UUID,
      desde: DESDE_ISO,
      hasta: HASTA_ISO,
    };

    // 401
    const p401 = firstValueFrom(service.queryDashboard(baseCriteria));
    httpMock
      .expectOne((r) => r.url === '/api/v1/tableros/coordinacion')
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect((await p401).error?.code).toBe('UNAUTHORIZED_SESSION');

    // 403
    const p403 = firstValueFrom(service.queryDashboard(baseCriteria));
    httpMock
      .expectOne((r) => r.url === '/api/v1/tableros/coordinacion')
      .flush(
        { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    const res403 = await p403;
    expect(res403.state).toBe('forbidden');
    expect(res403.error?.code).toBe('FORBIDDEN_ROLE');

    // 503
    const p503 = firstValueFrom(service.queryDashboard(baseCriteria));
    httpMock
      .expectOne((r) => r.url === '/api/v1/tableros/coordinacion')
      .flush(
        { statusCode: 503, message: 'L3A disabled', error: 'Service Unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    const res503 = await p503;
    expect(res503.state).toBe('error');
    expect(res503.error?.code).toBe('SERVICE_DISABLED_OR_UNAVAILABLE');

    httpMock.verify();
  });
});
