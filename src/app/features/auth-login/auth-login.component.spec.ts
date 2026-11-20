import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfileDto, TokensDto } from '../../core/contracts/openapi-dtos.contract';
import { authRefreshInterceptor } from '../../core/http/auth-refresh.interceptor';
import { AuthLoginComponent } from './auth-login.component';

const SESSION_UUID = '11111111-1111-4111-8111-111111111111';
const USER_UUID = '22222222-2222-4222-8222-222222222222';
const HOSP_UUID = '33333333-3333-4333-8333-333333333333';
const SRV_UUID = '44444444-4444-4444-8444-444444444444';

describe('AuthLoginComponent (F4-B Login UI, Context Selector & IAM Errors)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthLoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should render default SYNTHETIC_DEMO notice, submit login, clear password field and render authorized hospital/service selectors', () => {
    const fixture = TestBed.createComponent(AuthLoginComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="iam-disabled-default-notice"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="login-form-card"]')).not.toBeNull();

    const comp = fixture.componentInstance;
    comp.onIdentificadorChange('jefa_demo');
    comp.onPasswordChange('secret-123');
    comp.submitLogin();

    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    loginReq.flush({
      accessToken: 'ui-access-token',
      refreshToken: 'f'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: SESSION_UUID,
    } satisfies TokensDto);

    const meReq = httpMock.expectOne('/api/v1/auth/me');
    meReq.flush({
      usuarioId: USER_UUID,
      sessionId: SESSION_UUID,
      provider: 'local',
      assignments: [
        {
          kind: 'TITULAR',
          scope: { hospitalId: HOSP_UUID, divisionId: null, servicioId: SRV_UUID },
          permissions: ['PERSONAL_LEER'],
        },
      ],
    } satisfies ProfileDto);

    fixture.detectChanges();

    expect(el.querySelector('[data-testid="authenticated-session-card"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="profile-usuario-id"]')?.textContent).toContain(
      USER_UUID,
    );
    expect(el.querySelector('[data-testid="select-authorized-hospital"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="select-authorized-service"]')).not.toBeNull();

    // Verificar que los tokens nunca se muestran en el DOM
    expect(el.textContent).not.toContain('ui-access-token');
    expect(el.textContent).not.toContain('f'.repeat(64));

    // Logout desde UI
    comp.logoutSession();
    httpMock
      .expectOne('/api/v1/auth/logout')
      .flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="login-form-card"]')).not.toBeNull();
  });

  it('should display IAM 429 rate-limit error message cleanly without crashing', () => {
    const fixture = TestBed.createComponent(AuthLoginComponent);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp.onIdentificadorChange('jefa_demo');
    comp.onPasswordChange('wrong-pwd');
    comp.submitLogin();

    httpMock.expectOne('/api/v1/auth/login').flush(
      {
        statusCode: 429,
        message: 'Demasiados intentos; espere antes de reintentar.',
      },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '45' },
      },
    );

    fixture.detectChanges();
    const errBox = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="auth-http-error"]',
    );
    expect(errBox?.textContent).toContain('Demasiados intentos');
    expect(errBox?.textContent).toContain('45 s');
  });

  it('should explicitly toggle QA integration mode in RAM only and cleanly restore safe SYNTHETIC_DEMO mode (F4-E1)', () => {
    const fixture = TestBed.createComponent(AuthLoginComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp['isQaIntegrationModeActive']()).toBe(false);

    comp.activateQaIntegrationSession();
    fixture.detectChanges();
    expect(comp['isQaIntegrationModeActive']()).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    comp.restoreSafeSyntheticDemoMode();
    fixture.detectChanges();
    expect(comp['isQaIntegrationModeActive']()).toBe(false);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
