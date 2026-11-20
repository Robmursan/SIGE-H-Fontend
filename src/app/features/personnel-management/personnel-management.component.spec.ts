import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideSigehConfigurableGateways } from '../../core/config/gateway-selector.service';
import {
  AssignmentPageDto,
  EmployeeDetailDto,
  EmployeePageDto,
  ProfileDto,
  TokensDto,
} from '../../core/contracts/openapi-dtos.contract';
import { authRefreshInterceptor } from '../../core/http/auth-refresh.interceptor';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { PersonnelManagementComponent } from './personnel-management.component';

const SESSION_UUID = '10101010-1010-4010-8010-101010101010';
const USER_UUID = '20202020-2020-4020-8020-202020202020';
const HOSP_1 = '11111111-1111-4111-8111-111111111111';
const SRV_1 = '33333333-3333-4333-8333-333333333333';
const SRV_2 = '99999999-9999-4999-8999-999999999999';
const EMP_1 = '44444444-4444-4444-8444-444444444444';
const CONT_1 = '66666666-6666-4666-8666-666666666666';
const ADSC_1 = '77777777-7777-4777-8777-777777777777';

describe('PersonnelManagementComponent (F2 Synthetic Demo & F4-C OpenAPI Integration)', () => {
  let component: PersonnelManagementComponent;
  let fixture: ComponentFixture<PersonnelManagementComponent>;
  let authSession: AuthSessionService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonnelManagementComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
        ...provideSigehConfigurableGateways(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonnelManagementComponent);
    component = fixture.componentInstance;
    authSession = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should render plantilla KPIs, paginated personnel table and employee detail panel in SYNTHETIC_DEMO default mode', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="personnel-kpi-grid"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="personnel-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="employee-detail-panel"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="personnel-pagination"]')).toBeTruthy();
  });

  it('should navigate pages and update selected employee detail in SYNTHETIC_DEMO mode', () => {
    component.goToPage(2);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="personnel-pagination"]')?.textContent).toContain(
      'Página 2 de 3',
    );

    component.selectEmployee('EMP-DEMO-008');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="employee-detail-panel"]')?.textContent).toContain(
      'Carmen Espinosa Trejo (Demo)',
    );
  });

  it('should execute full F4-C flow (padrón -> detalle -> adscripciones por contrato), reset cursor on filter change, and wipe results on context change', async () => {
    // 1. Autenticar sesión IAM con 2 servicios autorizados
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'jefa_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'tok-f4c',
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
          permissions: ['PERSONAL_LEER'],
        },
        {
          kind: 'ENCARGADO',
          scope: { hospitalId: HOSP_1, divisionId: null, servicioId: SRV_2 },
          permissions: ['PERSONAL_LEER'],
        },
      ],
    } satisfies ProfileDto);
    await loginPromise;

    // 2. Activar modo real OpenAPI v1 explícitamente (opt-in)
    component.setPersonnelDataSourceMode('OPENAPI_HTTP_READY');
    fixture.detectChanges();

    const today = new Date().toISOString().slice(0, 10);
    const staffReq = httpMock.expectOne(
      `/api/v1/empleados?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=${today}&limit=25`,
    );
    staffReq.flush({
      items: [
        { empleadoId: EMP_1, nombres: 'Sofía', primerApellido: 'Ramírez', activo: true },
      ],
      nextCursor: EMP_1,
      limit: 25,
      order: 'id:asc',
    } satisfies EmployeePageDto);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="personnel-v1-projection-notice"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="personnel-table"]')?.textContent).toContain(
      'Sofía Ramírez',
    );
    // Verificar que no se inventan KPIs de plantilla en proyección v1
    expect(el.querySelector('[data-testid="personnel-kpi-grid"]')).toBeNull();

    // 3. Seleccionar empleado -> GET /api/v1/empleados/{empleadoId}
    component.selectEmployee(EMP_1);
    const detailReq = httpMock.expectOne(
      `/api/v1/empleados/${EMP_1}?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=${today}&limit=25`,
    );
    detailReq.flush({
      empleado: { empleadoId: EMP_1, nombres: 'Sofía', primerApellido: 'Ramírez', activo: true },
      adscripciones: {
        items: [
          {
            adscripcionId: ADSC_1,
            contratoId: CONT_1,
            servicioId: SRV_1,
            clase: 'OPERATIVA',
            inicio: '2026-01-15',
            fin: null,
          },
        ],
        nextCursor: null,
        limit: 25,
        order: 'id:asc',
      },
    } satisfies EmployeeDetailDto);
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="openapi-employee-summary"]')?.textContent).toContain(
      'Sofía Ramírez',
    );
    expect(el.querySelector(`[data-testid="btn-load-contract-${CONT_1}"]`)).toBeTruthy();

    // 4. Consultar adscripciones por contrato -> GET /api/v1/contratos/{contratoId}/adscripciones
    component.loadContractAssignments(CONT_1);
    const contractReq = httpMock.expectOne(
      `/api/v1/contratos/${CONT_1}/adscripciones?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=${today}&limit=25`,
    );
    contractReq.flush({
      items: [
        {
          adscripcionId: ADSC_1,
          contratoId: CONT_1,
          servicioId: SRV_1,
          clase: 'OPERATIVA',
          inicio: '2026-01-15',
          fin: null,
        },
      ],
      nextCursor: null,
      limit: 25,
      order: 'id:asc',
    } satisfies AssignmentPageDto);
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="contract-assignments-list"]')?.textContent).toContain(
      ADSC_1,
    );

    // 5. Avanzar cursor y luego cambiar filtro fecha -> debe reiniciar cursor a undefined y limpiar detalle
    component.loadNextStaffCursorPage();
    const cursorReq = httpMock.expectOne(
      `/api/v1/empleados?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=${today}&cursor=${EMP_1}&limit=25`,
    );

    // Cambiar fecha mientras cursorReq está pendiente -> debe cancelar cursorReq y reiniciar cursor!
    component.onEffectiveDateChange('2026-11-22');
    expect(cursorReq.cancelled).toBe(true);

    const resetReq = httpMock.expectOne(
      `/api/v1/empleados?hospitalId=${HOSP_1}&servicioId=${SRV_1}&fecha=2026-11-22&limit=25`,
    );
    resetReq.flush({
      items: [],
      nextCursor: null,
      limit: 25,
      order: 'id:asc',
    } satisfies EmployeePageDto);
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="openapi-employee-summary"]')).toBeNull();

    // 6. Cambiar de servicio autorizado -> limpia resultados y solicita el nuevo servicio; error 403 no expone datos
    component.onAuthorizedServiceChange(SRV_2);
    const srv2Req = httpMock.expectOne(
      `/api/v1/empleados?hospitalId=${HOSP_1}&servicioId=${SRV_2}&fecha=2026-11-22&limit=25`,
    );
    srv2Req.flush(
      { statusCode: 403, message: 'Ámbito insuficiente', error: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="personnel-table"]')).toBeNull();
    expect(el.textContent).toContain('Acceso Denegado');
  });
});
