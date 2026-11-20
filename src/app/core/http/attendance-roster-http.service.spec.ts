import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  PaseListaPageDto,
  ProfileDto,
  TokensDto,
} from '../contracts/openapi-dtos.contract';
import { AuthSessionService } from '../security/auth-session.service';
import { AttendanceRosterHttpService } from './attendance-roster-http.service';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_UUID = '11111111-1111-4111-8111-111111111111';
const SRV_UUID = '22222222-2222-4222-8222-222222222222';
const HOR_UUID = '33333333-3333-4333-8333-333333333333';
const PROG_UUID = '44444444-4444-4444-8444-444444444444';
const EMP_UUID = '55555555-5555-4555-8555-555555555555';
const ASI_UUID = '66666666-6666-4666-8666-666666666666';
const ACTOR_UUID = '77777777-7777-4777-8777-777777777777';

describe('AttendanceRosterHttpService (F4-F GET /api/v1/pases-lista)', () => {
  let service: AttendanceRosterHttpService;
  let authSession: AuthSessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AttendanceRosterHttpService);
    authSession = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function authenticateReadOnlyUserWithoutCaptureFaculty(): Promise<void> {
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'coord_lectura', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'roster-read-token',
      refreshToken: 'a'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    } satisfies TokensDto);
    // Usuario SIN ASISTENCIA_CAPTURAR: la autorización de lectura la evalúa NestJS
    httpMock.expectOne('/api/v1/auth/me').flush({
      usuarioId: USER_UUID,
      sessionId: SESSION_UUID,
      provider: 'local',
      assignments: [
        {
          kind: 'TITULAR',
          scope: { hospitalId: HOSP_UUID, divisionId: null, servicioId: SRV_UUID },
          permissions: ['PROGRAMACION_LEER'],
        },
      ],
    } satisfies ProfileDto);
    await loginPromise;
  }

  it('should consume GET /api/v1/pases-lista with exact contractual params without requiring ASISTENCIA_CAPTURAR locally', async () => {
    await authenticateReadOnlyUserWithoutCaptureFaculty();

    const promise = firstValueFrom(
      service.queryAttendanceRoster({
        fecha: '2026-11-18',
        horarioId: HOR_UUID,
        limit: 25,
      }),
    );

    const req = httpMock.expectOne(
      `/api/v1/pases-lista?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&horarioId=${HOR_UUID}&limit=25`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer roster-read-token');

    req.flush({
      hospitalId: HOSP_UUID,
      servicioId: SRV_UUID,
      fecha: '2026-11-18',
      zonaHoraria: 'America/Mexico_City',
      items: [
        {
          programacionId: PROG_UUID,
          empleado: { empleadoId: EMP_UUID, nombres: 'Elena', primerApellido: 'Morales' },
          horarioId: HOR_UUID,
          turnoCodigo: 'MAT',
          inicioProgramado: '2026-11-18T07:00:00-06:00',
          finProgramado: '2026-11-18T15:00:00-06:00',
          estadoProgramacion: 'PROGRAMADA',
          capturada: true,
          asistenciaId: ASI_UUID,
          estadoOperativo: 'PARCIAL',
          validacionAdministrativa: 'PENDIENTE',
          revision: '1',
          ultimaCaptura: {
            eventoId: '1000000000042',
            actorId: ACTOR_UUID,
            registradoEn: '2026-11-18T07:20:00-06:00',
          },
          capturable: false,
          motivoNoCapturable: 'SIN_FACULTAD_CAPTURA',
        },
      ],
      nextCursor: PROG_UUID,
      limit: 25,
      order: 'id:asc',
    } satisfies PaseListaPageDto);

    const res = await promise;
    expect(res.state).toBe('ready');
    expect(res.snapshot?.metadata.isSyntheticDemo).toBe(false);
    expect(res.snapshot?.zonaHoraria).toBe('America/Mexico_City');
    expect(res.snapshot?.items[0].estadoOperativo).toBe('PARCIAL');
    expect(res.snapshot?.items[0].ultimaCaptura?.actorId).toBe(ACTOR_UUID);
    expect(res.snapshot?.items[0].ultimaCaptura?.eventoId).toBe('1000000000042');
    expect(res.snapshot?.cursorPagination.nextCursor).toBe(PROG_UUID);
  });

  it('should handle validation 400 and HTTP 401, 403, 404 and 503 cleanly without exposing data', async () => {
    await authenticateReadOnlyUserWithoutCaptureFaculty();

    // horarioId no-UUID rechazado antes de emitir HTTP
    const badHorario = await firstValueFrom(
      service.queryAttendanceRoster({ fecha: '2026-11-18', horarioId: 'not-uuid' }),
    );
    expect(badHorario.state).toBe('error');
    expect(badHorario.error?.code).toBe('BAD_REQUEST_VALIDATION');

    const url = `/api/v1/pases-lista?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&limit=50`;

    // 401
    const p401 = firstValueFrom(service.queryAttendanceRoster({ fecha: '2026-11-18' }));
    httpMock
      .expectOne(url)
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect((await p401).error?.code).toBe('UNAUTHORIZED_SESSION');

    // 403 (facultad de lectura insuficiente — evaluada por NestJS)
    const p403 = firstValueFrom(service.queryAttendanceRoster({ fecha: '2026-11-18' }));
    httpMock
      .expectOne(url)
      .flush(
        { statusCode: 403, message: 'Facultad de lectura insuficiente', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    const res403 = await p403;
    expect(res403.state).toBe('forbidden');
    expect(res403.snapshot).toBeNull();

    // 404
    const p404 = firstValueFrom(service.queryAttendanceRoster({ fecha: '2026-11-18' }));
    httpMock
      .expectOne(url)
      .flush(
        { statusCode: 404, message: 'Servicio no disponible', error: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );
    expect((await p404).error?.code).toBe('RESOURCE_NOT_FOUND');

    // 503 (ASISTENCIA deshabilitado por defecto)
    const p503 = firstValueFrom(service.queryAttendanceRoster({ fecha: '2026-11-18' }));
    httpMock
      .expectOne(url)
      .flush(
        { statusCode: 503, message: 'ASISTENCIA deshabilitado por defecto', error: 'Service Unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    const res503 = await p503;
    expect(res503.state).toBe('error');
    expect(res503.error?.code).toBe('SERVICE_DISABLED_OR_UNAVAILABLE');
  });
});
