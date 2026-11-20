import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  AssignmentPageDto,
  EmployeeDetailDto,
  EmployeePageDto,
  ProfileDto,
  TokensDto,
} from '../contracts/openapi-dtos.contract';
import { AuthSessionService } from '../security/auth-session.service';
import { PersonnelHttpService } from './personnel-http.service';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_UUID = '11111111-1111-4111-8111-111111111111';
const DIV_UUID = '22222222-2222-4222-8222-222222222222';
const SRV_UUID = '33333333-3333-4333-8333-333333333333';
const EMP_UUID_1 = '44444444-4444-4444-8444-444444444444';
const EMP_UUID_2 = '55555555-5555-4555-8555-555555555555';
const CONT_UUID = '66666666-6666-4666-8666-666666666666';
const ADSC_UUID_1 = '77777777-7777-4777-8777-777777777777';
const ADSC_UUID_2 = '88888888-8888-4888-8888-888888888888';

describe('PersonnelHttpService (F4-C OpenAPI L3B-2A Real Endpoints)', () => {
  let service: PersonnelHttpService;
  let authSession: AuthSessionService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PersonnelHttpService);
    authSession = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function authenticateTestSession(): Promise<void> {
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'sup_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'scoped-access-token',
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
          permissions: ['PERSONAL_LEER'],
        },
      ],
    } satisfies ProfileDto);
    await loginPromise;
  }

  it('should consume GET /api/v1/empleados, GET /api/v1/empleados/{empleadoId} and GET /api/v1/contratos/{contratoId}/adscripciones with exact contractual params and cursor pagination', async () => {
    await authenticateTestSession();

    // 1. Padrón (página 1 con cursor de salida)
    const p1 = firstValueFrom(
      service.queryPersonnel({
        fecha: '2026-11-18',
        limit: 25,
      }),
    );

    const staffReq1 = httpMock.expectOne(
      `/api/v1/empleados?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&divisionId=${DIV_UUID}&limit=25`,
    );
    expect(staffReq1.request.method).toBe('GET');
    expect(staffReq1.request.headers.get('Authorization')).toBe('Bearer scoped-access-token');

    staffReq1.flush({
      items: [
        {
          empleadoId: EMP_UUID_1,
          nombres: 'Elena',
          primerApellido: 'Morales',
          activo: true,
        },
      ],
      nextCursor: EMP_UUID_1,
      limit: 25,
      order: 'id:asc',
    } satisfies EmployeePageDto);

    const staffRes1 = await p1;
    expect(staffRes1.state).toBe('ready');
    expect(staffRes1.snapshot?.metadata.isSyntheticDemo).toBe(false);
    expect(staffRes1.snapshot?.items[0].employeeId).toBe(EMP_UUID_1);
    expect(staffRes1.snapshot?.items[0].fullNameDemo).toBe('Elena Morales');
    expect(staffRes1.snapshot?.cursorPagination?.nextCursor).toBe(EMP_UUID_1);

    // 1b. Padrón página 2 usando cursor
    const p2 = firstValueFrom(
      service.queryPersonnel({
        fecha: '2026-11-18',
        cursor: EMP_UUID_1,
        limit: 25,
      }),
    );
    const staffReq2 = httpMock.expectOne(
      `/api/v1/empleados?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&divisionId=${DIV_UUID}&cursor=${EMP_UUID_1}&limit=25`,
    );
    staffReq2.flush({
      items: [
        {
          empleadoId: EMP_UUID_2,
          nombres: 'Carlos',
          primerApellido: 'Núñez',
          activo: false,
        },
      ],
      nextCursor: null,
      limit: 25,
      order: 'id:asc',
    } satisfies EmployeePageDto);
    const staffRes2 = await p2;
    expect(staffRes2.snapshot?.cursorPagination?.nextCursor).toBeNull();
    expect(staffRes2.snapshot?.items[0].activoContractFlag).toBe(false);

    // 2. Detalle de empleado (`GET /api/v1/empleados/{empleadoId}`)
    const detailPromise = firstValueFrom(
      service.getEmployeeDetail({
        empleadoId: EMP_UUID_1,
        hospitalId: HOSP_UUID,
        servicioId: SRV_UUID,
        divisionId: DIV_UUID,
        fecha: '2026-11-18',
        limit: 50,
      }),
    );
    const detailReq = httpMock.expectOne(
      `/api/v1/empleados/${EMP_UUID_1}?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&divisionId=${DIV_UUID}&limit=50`,
    );
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush({
      empleado: {
        empleadoId: EMP_UUID_1,
        nombres: 'Elena',
        primerApellido: 'Morales',
        activo: true,
      },
      adscripciones: {
        items: [
          {
            adscripcionId: ADSC_UUID_1,
            contratoId: CONT_UUID,
            servicioId: SRV_UUID,
            clase: 'NOMINAL',
            inicio: '2025-01-01',
            fin: null,
          },
        ],
        nextCursor: null,
        limit: 50,
        order: 'id:asc',
      },
    } satisfies EmployeeDetailDto);

    const detailRes = await detailPromise;
    expect(detailRes.state).toBe('ready');
    expect(detailRes.detail?.distinctContractIds).toEqual([CONT_UUID]);
    expect(detailRes.detail?.assignments[0].clase).toBe('NOMINAL');
    expect(detailRes.detail?.assignments[0].fin).toBeNull();

    // 3. Adscripciones por contrato (`GET /api/v1/contratos/{contratoId}/adscripciones`)
    const assignPromise = firstValueFrom(
      service.listContractAssignments({
        contratoId: CONT_UUID,
        hospitalId: HOSP_UUID,
        servicioId: SRV_UUID,
        fecha: '2026-11-18',
        limit: 20,
      }),
    );
    const assignReq = httpMock.expectOne(
      `/api/v1/contratos/${CONT_UUID}/adscripciones?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&limit=20`,
    );
    expect(assignReq.request.method).toBe('GET');
    assignReq.flush({
      items: [
        {
          adscripcionId: ADSC_UUID_1,
          contratoId: CONT_UUID,
          servicioId: SRV_UUID,
          clase: 'NOMINAL',
          inicio: '2025-01-01',
          fin: null,
        },
        {
          adscripcionId: ADSC_UUID_2,
          contratoId: CONT_UUID,
          servicioId: SRV_UUID,
          clase: 'OPERATIVA',
          inicio: '2026-06-01',
          fin: '2026-12-31',
        },
      ],
      nextCursor: ADSC_UUID_2,
      limit: 20,
      order: 'id:asc',
    } satisfies AssignmentPageDto);

    const assignRes = await assignPromise;
    expect(assignRes.state).toBe('ready');
    expect(assignRes.items.length).toBe(2);
    expect(assignRes.cursorPagination?.nextCursor).toBe(ADSC_UUID_2);
  });

  it('should handle 401, 403, 404, 503 and missing authorized context without leaking data', async () => {
    // Sin sesión / contexto autorizado -> error controlado sin emitir tráfico HTTP
    const noCtxRes = await firstValueFrom(service.queryPersonnel({ fecha: '2026-11-18' }));
    expect(noCtxRes.state).toBe('error');
    expect(noCtxRes.snapshot).toBeNull();
    expect(noCtxRes.error?.code).toBe('BAD_REQUEST_VALIDATION');

    await authenticateTestSession();

    // 401 Unauthorized
    const p401 = firstValueFrom(service.queryPersonnel({ fecha: '2026-11-18' }));
    httpMock
      .expectOne(
        `/api/v1/empleados?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&divisionId=${DIV_UUID}&limit=50`,
      )
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
    const res401 = await p401;
    expect(res401.state).toBe('error');
    expect(res401.snapshot).toBeNull();
    expect(res401.error?.code).toBe('UNAUTHORIZED_SESSION');

    // 403 Forbidden
    const p403 = firstValueFrom(service.queryPersonnel({ fecha: '2026-11-18' }));
    httpMock
      .expectOne(
        `/api/v1/empleados?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&divisionId=${DIV_UUID}&limit=50`,
      )
      .flush(
        { statusCode: 403, message: 'Facultad o ámbito insuficiente', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    const res403 = await p403;
    expect(res403.state).toBe('forbidden');
    expect(res403.snapshot).toBeNull();
    expect(res403.error?.code).toBe('FORBIDDEN_ROLE');

    // 404 Not Found en detalle de empleado
    const p404 = firstValueFrom(
      service.getEmployeeDetail({
        empleadoId: EMP_UUID_2,
        hospitalId: HOSP_UUID,
        servicioId: SRV_UUID,
        fecha: '2026-11-18',
      }),
    );
    httpMock
      .expectOne(
        `/api/v1/empleados/${EMP_UUID_2}?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&limit=50`,
      )
      .flush(
        { statusCode: 404, message: 'Empleado no disponible', error: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );
    const res404 = await p404;
    expect(res404.state).toBe('error');
    expect(res404.detail).toBeNull();
    expect(res404.error?.code).toBe('RESOURCE_NOT_FOUND');

    // 503 Service Unavailable en adscripciones por contrato (L3A_READS_ENABLED=false)
    const p503 = firstValueFrom(
      service.listContractAssignments({
        contratoId: CONT_UUID,
        hospitalId: HOSP_UUID,
        servicioId: SRV_UUID,
        fecha: '2026-11-18',
      }),
    );
    httpMock
      .expectOne(
        `/api/v1/contratos/${CONT_UUID}/adscripciones?hospitalId=${HOSP_UUID}&servicioId=${SRV_UUID}&fecha=2026-11-18&limit=50`,
      )
      .flush(
        { statusCode: 503, message: 'L3A_READS_ENABLED deshabilitado', error: 'Service Unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    const res503 = await p503;
    expect(res503.state).toBe('error');
    expect(res503.items).toEqual([]);
    expect(res503.error?.code).toBe('SERVICE_DISABLED_OR_UNAVAILABLE');
  });
});
