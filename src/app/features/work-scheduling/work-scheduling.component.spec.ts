import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideSigehConfigurableGateways } from '../../core/config/gateway-selector.service';
import {
  ProfileDto,
  SchedulePageDto,
  TokensDto,
} from '../../core/contracts/openapi-dtos.contract';
import { authRefreshInterceptor } from '../../core/http/auth-refresh.interceptor';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { WorkSchedulingComponent } from './work-scheduling.component';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_1 = '11111111-1111-4111-8111-111111111111';
const SRV_1 = '33333333-3333-4333-8333-333333333333';
const SRV_2 = '99999999-9999-4999-8999-999999999999';
const PROG_1 = '44444444-4444-4444-8444-444444444444';
const EMP_1 = '55555555-5555-4555-8555-555555555555';

describe('WorkSchedulingComponent (F2 Synthetic Demo & F4-D OpenAPI Integration)', () => {
  let component: WorkSchedulingComponent;
  let fixture: ComponentFixture<WorkSchedulingComponent>;
  let authSession: AuthSessionService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkSchedulingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
        ...provideSigehConfigurableGateways(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkSchedulingComponent);
    component = fixture.componentInstance;
    authSession = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should render scheme summaries, weekly calendar table and coverage alerts in SYNTHETIC_DEMO default mode', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="scheduling-schemes-grid"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="weekly-schedule-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="scheduling-alerts-section"]')).toBeTruthy();
  });

  it('should filter by schedule scheme and handle loading/error states in SYNTHETIC_DEMO mode', () => {
    const el = fixture.nativeElement as HTMLElement;

    component.onSchemeChange('Jornada Acumulada');
    fixture.detectChanges();
    const rows = el.querySelectorAll('[data-testid^="schedule-row-"]');
    expect(rows.length).toBe(2);

    component.setSimulatedState('loading');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-loading"]')).toBeTruthy();

    component.setSimulatedState('error');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-error"]')).toBeTruthy();
  });

  it('should consume GET /api/v1/programaciones in OPENAPI_HTTP_READY mode, paginate by cursor, cancel pending on filter change and wipe on context switch', async () => {
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'sup_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'tok-sched',
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

    component.setSchedulingDataSourceMode('OPENAPI_HTTP_READY');
    fixture.detectChanges();

    const req1 = httpMock.expectOne((r) => r.url === '/api/v1/programaciones');
    expect(req1.request.params.get('hospitalId')).toBe(HOSP_1);
    expect(req1.request.params.get('servicioId')).toBe(SRV_1);
    req1.flush({
      items: [
        {
          programacionId: PROG_1,
          empleadoId: EMP_1,
          servicioId: SRV_1,
          horarioId: null,
          turnoCodigo: 'MAT',
          inicioProgramado: '2026-11-16T07:00:00-06:00',
          finProgramado: '2026-11-16T15:00:00-06:00',
          estado: 'PROGRAMADA',
        },
      ],
      nextCursor: PROG_1,
      limit: 50,
      order: 'id:asc',
    } satisfies SchedulePageDto);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="openapi-scheduling-table"]')?.textContent).toContain(
      PROG_1,
    );
    expect(el.querySelector('[data-testid="scheduling-coverage-unavailable-notice"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="scheduling-alerts-section"]')).toBeNull();

    // Avanzar cursor y cambiar ventana mientras está pendiente -> cancela y reinicia cursor
    component.loadNextCursorPage();
    const cursorReq = httpMock.expectOne((r) => r.url === '/api/v1/programaciones');
    expect(cursorReq.request.params.get('cursor')).toBe(PROG_1);

    component.onWindowRangeChange('2026-11-16T00:00:00-06:00', '2026-11-20T00:00:00-06:00');
    expect(cursorReq.cancelled).toBe(true);

    const newWinReq = httpMock.expectOne((r) => r.url === '/api/v1/programaciones');
    expect(newWinReq.request.params.has('cursor')).toBe(false);
    expect(newWinReq.request.params.get('hasta')).toBe('2026-11-20T00:00:00-06:00');
    newWinReq.flush({ items: [], nextCursor: null, limit: 50, order: 'id:asc' });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-empty"]')).toBeTruthy();

    // Cambiar de servicio autorizado -> limpia y consulta nuevo servicio; 403 no expone datos
    component.onAuthorizedServiceChange(SRV_2);
    const srv2Req = httpMock.expectOne((r) => r.url === '/api/v1/programaciones');
    expect(srv2Req.request.params.get('servicioId')).toBe(SRV_2);
    srv2Req.flush(
      { statusCode: 403, message: 'Sin permiso', error: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="openapi-scheduling-table"]')).toBeNull();
    expect(el.querySelector('[data-testid="state-panel-forbidden"]')).toBeTruthy();
  });
});
