import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideSigehConfigurableGateways } from '../../core/config/gateway-selector.service';
import {
  PaseListaPageDto,
  ProfileDto,
  TokensDto,
} from '../../core/contracts/openapi-dtos.contract';
import { authRefreshInterceptor } from '../../core/http/auth-refresh.interceptor';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { AttendanceRosterComponent } from './attendance-roster.component';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_1 = '11111111-1111-4111-8111-111111111111';
const SRV_1 = '22222222-2222-4222-8222-222222222222';
const SRV_2 = '99999999-9999-4999-8999-999999999999';
const PROG_1 = '33333333-3333-4333-8333-333333333333';
const EMP_1 = '44444444-4444-4444-8444-444444444444';
const ASI_1 = '55555555-5555-4555-8555-555555555555';
const ACTOR_1 = '66666666-6666-4666-8666-666666666666';

describe('AttendanceRosterComponent (F4-F Pases de Lista en Coordinación)', () => {
  let component: AttendanceRosterComponent;
  let fixture: ComponentFixture<AttendanceRosterComponent>;
  let authSession: AuthSessionService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceRosterComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
        ...provideSigehConfigurableGateways(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceRosterComponent);
    component = fixture.componentInstance;
    authSession = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should render in SYNTHETIC_DEMO mode by default without emitting HTTP requests', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="synthetic-demo-banner"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="roster-semantic-separation-notice"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="attendance-roster-table"]')?.textContent).toContain(
      'PRESENTE',
    );
    expect(el.querySelector('[data-testid="attendance-roster-table"]')?.textContent).toContain(
      'AUSENTE',
    );
    expect(el.querySelector('[data-testid="attendance-roster-table"]')?.textContent).toContain(
      'PARCIAL',
    );
  });

  it('should query GET /api/v1/pases-lista in OPENAPI_HTTP_READY mode, render traceability, cancel pending on filter change and wipe on context switch or logout', async () => {
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'coord_qa', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'tok-pases',
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
          scope: { hospitalId: HOSP_1, divisionId: null, servicioId: SRV_1 },
          permissions: ['PROGRAMACION_LEER'],
        },
        {
          kind: 'ENCARGADO',
          scope: { hospitalId: HOSP_1, divisionId: null, servicioId: SRV_2 },
          permissions: ['PROGRAMACION_LEER'],
        },
      ],
    } satisfies ProfileDto);
    await loginPromise;

    component.setRosterDataSourceMode('OPENAPI_HTTP_READY');
    fixture.detectChanges();

    const today = new Date().toISOString().slice(0, 10);
    const req1 = httpMock.expectOne(
      `/api/v1/pases-lista?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=${today}&limit=50`,
    );
    req1.flush({
      hospitalId: HOSP_1,
      servicioId: SRV_1,
      fecha: today,
      zonaHoraria: 'America/Mexico_City',
      items: [
        {
          programacionId: PROG_1,
          empleado: { empleadoId: EMP_1, nombres: 'Sofía', primerApellido: 'Ramírez' },
          horarioId: null,
          turnoCodigo: 'MAT',
          inicioProgramado: `${today}T07:00:00-06:00`,
          finProgramado: `${today}T15:00:00-06:00`,
          estadoProgramacion: 'PROGRAMADA',
          capturada: true,
          asistenciaId: ASI_1,
          estadoOperativo: 'PRESENTE',
          validacionAdministrativa: 'PENDIENTE',
          revision: '1',
          ultimaCaptura: {
            eventoId: '9007199254740995001',
            actorId: ACTOR_1,
            registradoEn: `${today}T07:11:00-06:00`,
          },
          capturable: false,
          motivoNoCapturable: 'YA_REGISTRADA',
        },
      ],
      nextCursor: PROG_1,
      limit: 50,
      order: 'id:asc',
    } satisfies PaseListaPageDto);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const tableText = el.querySelector('[data-testid="attendance-roster-table"]')?.textContent ?? '';
    expect(tableText).toContain('Sofía Ramírez');
    expect(tableText).toContain('PRESENTE');
    expect(tableText).toContain(ACTOR_1);
    expect(tableText).toContain('#9007199254740995001');

    // Avanzar cursor y cambiar fecha mientras está pendiente -> cancela solicitud y reinicia cursor
    component.loadNextCursorPage();
    const cursorReq = httpMock.expectOne(
      `/api/v1/pases-lista?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=${today}&cursor=${PROG_1}&limit=50`,
    );

    component.onFechaChange('2026-11-22');
    expect(cursorReq.cancelled).toBe(true);

    const newDateReq = httpMock.expectOne(
      `/api/v1/pases-lista?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=2026-11-22&limit=50`,
    );
    newDateReq.flush({
      hospitalId: HOSP_1,
      servicioId: SRV_1,
      fecha: '2026-11-22',
      zonaHoraria: 'America/Mexico_City',
      items: [],
      nextCursor: null,
      limit: 50,
      order: 'id:asc',
    } satisfies PaseListaPageDto);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-empty"]')).toBeTruthy();

    // Cambiar de servicio autorizado -> 403 limpia tabla sin exposición residual
    component.onAuthorizedServiceChange(SRV_2);
    const srv2Req = httpMock.expectOne(
      `/api/v1/pases-lista?hospitalId=${HOSP_1}&servicioId=${SRV_2}&fecha=2026-11-22&limit=50`,
    );
    srv2Req.flush(
      { statusCode: 403, message: 'Sin facultad de lectura', error: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="attendance-roster-table"]')).toBeNull();
    expect(el.querySelector('[data-testid="state-panel-forbidden"]')).toBeTruthy();

    // Logout limpia todo el estado
    const logoutPromise = firstValueFrom(authSession.logout());
    httpMock
      .expectOne('/api/v1/auth/logout')
      .flush(null, { status: 204, statusText: 'No Content' });
    await logoutPromise;
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="attendance-roster-table"]')).toBeNull();
  });
});
