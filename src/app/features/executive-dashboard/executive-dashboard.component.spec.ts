import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideSigehConfigurableGateways } from '../../core/config/gateway-selector.service';
import {
  ProfileDto,
  ProgrammingDashboardDto,
  TokensDto,
} from '../../core/contracts/openapi-dtos.contract';
import { authRefreshInterceptor } from '../../core/http/auth-refresh.interceptor';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { ExecutiveDashboardComponent } from './executive-dashboard.component';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_1 = '11111111-1111-4111-8111-111111111111';
const SRV_1 = '33333333-3333-4333-8333-333333333333';
const SRV_2 = '99999999-9999-4999-8999-999999999999';

describe('ExecutiveDashboardComponent (F1 Synthetic Demo & F4-D Coordination Dashboard)', () => {
  let component: ExecutiveDashboardComponent;
  let fixture: ComponentFixture<ExecutiveDashboardComponent>;
  let authSession: AuthSessionService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutiveDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
        ...provideSigehConfigurableGateways(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutiveDashboardComponent);
    component = fixture.componentInstance;
    authSession = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should render the synthetic demo banner and 4 executive KPI cards by default', () => {
    const el = fixture.nativeElement as HTMLElement;

    const demoBanner = el.querySelector('[data-testid="synthetic-demo-banner"]');
    expect(demoBanner).toBeTruthy();
    expect(demoBanner?.textContent).toContain('DEMOSTRACIÓN SINTÉTICA F1');

    expect(el.querySelector('[data-testid="kpi-card-personal"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="kpi-card-asistencia"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="kpi-card-incidencias"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="kpi-card-cobertura"]')).toBeTruthy();
  });

  it('should filter services when selecting a specific shift in SYNTHETIC_DEMO mode', () => {
    component.setShift('Vespertino');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('[data-testid^="row-service-"]');
    expect(rows.length).toBe(2);
  });

  it('should display loading, empty, error and forbidden UI states when selected in SYNTHETIC_DEMO mode', () => {
    const el = fixture.nativeElement as HTMLElement;

    component.setSimulatedState('loading');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-loading"]')).toBeTruthy();

    component.setSimulatedState('empty');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-empty"]')).toBeTruthy();

    component.setSimulatedState('error');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-error"]')).toBeTruthy();

    component.setSimulatedState('forbidden');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="state-panel-forbidden"]')).toBeTruthy();
  });

  it('should render real programming indicators with PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA semantics, show unavailable blocks without synthetic fallback, and wipe on context change or logout', async () => {
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'coord_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'tok-dash',
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
          permissions: ['TABLERO_LEER'],
        },
        {
          kind: 'ENCARGADO',
          scope: { hospitalId: HOSP_1, divisionId: null, servicioId: SRV_2 },
          permissions: ['TABLERO_LEER'],
        },
      ],
    } satisfies ProfileDto);
    await loginPromise;

    component.setDashboardDataSourceMode('OPENAPI_HTTP_READY');
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/api/v1/tableros/coordinacion');
    expect(req.request.params.get('hospitalId')).toBe(HOSP_1);
    expect(req.request.params.get('servicioId')).toBe(SRV_1);

    req.flush({
      base: 'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA',
      jornadas: 30,
      empleadosProgramados: 14,
      programadas: 25,
      canceladas: 2,
      sustituidas: 1,
      cerradas: 2,
      horasPersonaProgramadas: 240,
    } satisfies ProgrammingDashboardDto);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="dashboard-semantic-disclaimer"]')?.textContent).toContain(
      'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA',
    );
    expect(el.querySelector('[data-testid="metric-jornadas"]')?.textContent).toContain('30');
    expect(el.querySelector('[data-testid="metric-horas-persona"]')?.textContent).toContain('240 h');
    expect(el.querySelector('[data-testid="unavailable-attendance"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="unavailable-coverage"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="unavailable-incidents"]')).toBeTruthy();
    // Verificar que NO se muestran tablas ni KPIs sintéticos en modo real
    expect(el.querySelector('[data-testid="kpi-cards-grid"]')).toBeNull();
    expect(el.querySelector('[data-testid="coverage-table"]')).toBeNull();

    // Cambiar de servicio -> limpia indicadores previos; si falla 503, no queda información residual
    component.onAuthorizedServiceChange(SRV_2);
    const req2 = httpMock.expectOne((r) => r.url === '/api/v1/tableros/coordinacion');
    expect(req2.request.params.get('servicioId')).toBe(SRV_2);
    req2.flush(
      { statusCode: 503, message: 'L3A disabled', error: 'Service Unavailable' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="coordination-programming-panel"]')).toBeNull();
    expect(el.querySelector('[data-testid="state-panel-error"]')).toBeTruthy();

    // Logout limpia cualquier estado restante
    const logoutPromise = firstValueFrom(authSession.logout());
    httpMock
      .expectOne('/api/v1/auth/logout')
      .flush(null, { status: 204, statusText: 'No Content' });
    await logoutPromise;
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="coordination-programming-panel"]')).toBeNull();
  });
});
