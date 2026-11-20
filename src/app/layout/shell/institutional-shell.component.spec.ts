import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GatewaySelectorService } from '../../core/config/gateway-selector.service';
import { InstitutionalShellComponent } from './institutional-shell.component';

describe('InstitutionalShellComponent', () => {
  let component: InstitutionalShellComponent;
  let fixture: ComponentFixture<InstitutionalShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstitutionalShellComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(InstitutionalShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the institutional sidebar, header and navigation links', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="institutional-sidebar"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="institutional-header"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="header-demo-pill"]')?.textContent).toContain(
      'MODO DEMO SINTÉTICO',
    );
  });

  it('should switch sidebar and header labels cleanly when QA opt-in mode is activated without mixing synthetic branding (F4-E1)', () => {
    const selector = TestBed.inject(GatewaySelectorService);
    selector.setGlobalMode('OPENAPI_HTTP_READY');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="header-demo-pill"]')?.textContent).toContain(
      'INTEGRACIÓN QA (OPT-IN)',
    );
    expect(el.querySelector('[data-testid="sidebar-context-card"]')?.textContent).not.toContain(
      'Hospital Modelo Sintético',
    );

    selector.resetToDefaultSafeDemoMode();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="header-demo-pill"]')?.textContent).toContain(
      'MODO DEMO SINTÉTICO',
    );
  });

  it('should toggle mobile menu and sidebar collapse state', () => {
    const el = fixture.nativeElement as HTMLElement;

    component.toggleMobileMenu();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="mobile-backdrop"]')).toBeTruthy();

    component.closeMobileMenu();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="mobile-backdrop"]')).toBeNull();

    component.toggleSidebarCollapse();
    fixture.detectChanges();
    expect(el.querySelector('.shell--sidebar-collapsed')).toBeTruthy();
  });
});
