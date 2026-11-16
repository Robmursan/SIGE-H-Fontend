import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InstitutionalShellComponent } from './institutional-shell.component';

describe('InstitutionalShellComponent', () => {
  let component: InstitutionalShellComponent;
  let fixture: ComponentFixture<InstitutionalShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstitutionalShellComponent],
      providers: [provideRouter([])],
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
