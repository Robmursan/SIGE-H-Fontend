import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  ProfileDto,
  SchedulePageDto,
  TokensDto,
} from '../contracts/openapi-dtos.contract';
import { AuthSessionService } from '../security/auth-session.service';
import { SchedulingHttpService } from './scheduling-http.service';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_UUID = '11111111-1111-4111-8111-111111111111';
const DIV_UUID = '22222222-2222-4222-8222-222222222222';
const SRV_UUID = '33333333-3333-4333-8333-333333333333';
const PROG_UUID_1 = '44444444-4444-4444-8444-444444444444';
const PROG_UUID_2 = '55555555-5555-4555-8555-555555555555';
const EMP_UUID = '66666666-6666-4666-8666-666666666666';

const DESDE_ISO = '2026-11-16T00:00:00-06:00';
const HASTA_ISO = '2026-11-23T00:00:00-06:00';

describe('SchedulingHttpService (F4-D GET /api/v1/programaciones)', () => {
  let service: SchedulingHttpService;
  let authSession: AuthSessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SchedulingHttpService);
    authSession = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function authenticateTestSession(): Promise<void> {
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'coord_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'sched-access-token',
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
          permissions: ['PROGRAMACION_LEER'],
        },
      ],
    } satisfies ProfileDto);
    await loginPromise;
  }

  it('should consume GET /api/v1/programaciones with ISO-8601 offset window (<=168h) and cursor pagination', async () => {
    await authenticateTestSession();

    const p1 = firstValueFrom(
      service.queryWeeklySchedule({
        desde: DESDE_ISO,
        hasta: HASTA_ISO,
        limit: 25,
      }),
    );

    const req1 = httpMock.expectOne((r) => r.url === '/api/v1/programaciones');
    expect(req1.request.method).toBe('GET');
    expect(req1.request.params.get('hospitalId')).toBe(HOSP_UUID);
    expect(req1.request.params.get('servicioId')).toBe(SRV_UUID);
    expect(req1.request.params.get('divisionId')).toBe(DIV_UUID);
    expect(req1.request.params.get('desde')).toBe(DESDE_ISO);
    expect(req1.request.params.get('hasta')).toBe(HASTA_ISO);
    expect(req1.request.params.get('limit')).toBe('25');

    req1.flush({
      items: [
        {
          programacionId: PROG_UUID_1,
          empleadoId: EMP_UUID,
          servicioId: SRV_UUID,
          horarioId: null,
          turnoCodigo: 'NOC',
          inicioProgramado: '2026-11-16T20:00:00-06:00',
          finProgramado: '2026-11-17T08:00:00-06:00',
          estado: 'PROGRAMADA',
        },
      ],
      nextCursor: PROG_UUID_1,
      limit: 25,
      order: 'id:asc',
    } satisfies SchedulePageDto);

    const res1 = await p1;
    expect(res1.state).toBe('ready');
    expect(res1.snapshot?.metadata.isSyntheticDemo).toBe(false);
    expect(res1.snapshot?.scopedItems?.[0].estado).toBe('PROGRAMADA');
    expect(res1.snapshot?.cursorPagination?.nextCursor).toBe(PROG_UUID_1);

    // Página 2 con cursor
    const p2 = firstValueFrom(
      service.queryWeeklySchedule({
        desde: DESDE_ISO,
        hasta: HASTA_ISO,
        cursor: PROG_UUID_1,
        limit: 25,
      }),
    );
    const req2 = httpMock.expectOne((r) => r.url === '/api/v1/programaciones');
    expect(req2.request.params.get('cursor')).toBe(PROG_UUID_1);
    req2.flush({
      items: [
        {
          programacionId: PROG_UUID_2,
          empleadoId: EMP_UUID,
          servicioId: SRV_UUID,
          horarioId: null,
          turnoCodigo: null,
          inicioProgramado: '2026-11-18T07:00:00-06:00',
          finProgramado: '2026-11-18T15:00:00-06:00',
          estado: 'SUSTITUIDA',
        },
      ],
      nextCursor: null,
      limit: 25,
      order: 'id:asc',
    } satisfies SchedulePageDto);

    const res2 = await p2;
    expect(res2.snapshot?.cursorPagination?.nextCursor).toBeNull();
    expect(res2.snapshot?.scopedItems?.[0].estado).toBe('SUSTITUIDA');
  });

  it('should reject >168h windows and handle HTTP 400, 401, 403 and 503 cleanly without exposing data', async () => {
    await authenticateTestSession();

    // Ventana > 168 h rechazada antes de despachar HTTP
    const over168 = await firstValueFrom(
      service.queryWeeklySchedule({
        desde: '2026-11-16T00:00:00-06:00',
        hasta: '2026-11-24T00:00:00-06:00',
      }),
    );
    expect(over168.state).toBe('error');
    expect(over168.error?.code).toBe('BAD_REQUEST_VALIDATION');
    expect(over168.error?.message).toContain('168 horas');

    // 400 del servidor
    const p400 = firstValueFrom(service.queryWeeklySchedule({ desde: DESDE_ISO, hasta: HASTA_ISO }));
    httpMock
      .expectOne((r) => r.url === '/api/v1/programaciones')
      .flush(
        { statusCode: 400, message: 'Ventana inválida', error: 'Bad Request' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect((await p400).error?.code).toBe('BAD_REQUEST_VALIDATION');

    // 401
    const p401 = firstValueFrom(service.queryWeeklySchedule({ desde: DESDE_ISO, hasta: HASTA_ISO }));
    httpMock
      .expectOne((r) => r.url === '/api/v1/programaciones')
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect((await p401).error?.code).toBe('UNAUTHORIZED_SESSION');

    // 403 Forbidden
    const p403 = firstValueFrom(service.queryWeeklySchedule({ desde: DESDE_ISO, hasta: HASTA_ISO }));
    httpMock
      .expectOne((r) => r.url === '/api/v1/programaciones')
      .flush(
        { statusCode: 403, message: 'Ámbito insuficiente', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    const res403 = await p403;
    expect(res403.state).toBe('forbidden');
    expect(res403.snapshot).toBeNull();

    // 503 Disabled
    const p503 = firstValueFrom(service.queryWeeklySchedule({ desde: DESDE_ISO, hasta: HASTA_ISO }));
    httpMock
      .expectOne((r) => r.url === '/api/v1/programaciones')
      .flush(
        { statusCode: 503, message: 'L3A_READS_ENABLED=false', error: 'Service Unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    const res503 = await p503;
    expect(res503.state).toBe('error');
    expect(res503.error?.code).toBe('SERVICE_DISABLED_OR_UNAVAILABLE');
  });
});
