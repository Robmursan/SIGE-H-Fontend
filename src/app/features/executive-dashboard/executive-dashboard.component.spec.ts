import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SyntheticExecutiveDashboardAdapter } from '../../core/adapters/synthetic-executive-dashboard.adapter';
import { EXECUTIVE_DASHBOARD_GATEWAY } from '../../core/ports/executive-dashboard.gateway';
import { ExecutiveDashboardComponent } from './executive-dashboard.component';

describe('ExecutiveDashboardComponent', () => {
  let component: ExecutiveDashboardComponent;
  let fixture: ComponentFixture<ExecutiveDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutiveDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: EXECUTIVE_DASHBOARD_GATEWAY,
          useExisting: SyntheticExecutiveDashboardAdapter,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutiveDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the synthetic demo banner and 4 executive KPI cards by default', () => {
    const el = fixture.nativeElement as HTMLElement;

    const demoBanner = el.querySelector('[data-testid="synthetic-demo-banner"]');
    expect(demoBanner).toBeTruthy();
    expect(demoBanner?.textContent).toContain('DEMOSTRACIÓN SINTÉTICA F1');

    const personalCard = el.querySelector('[data-testid="kpi-card-personal"]');
    const asistenciaCard = el.querySelector('[data-testid="kpi-card-asistencia"]');
    const incidenciasCard = el.querySelector('[data-testid="kpi-card-incidencias"]');
    const coberturaCard = el.querySelector('[data-testid="kpi-card-cobertura"]');

    expect(personalCard).toBeTruthy();
    expect(asistenciaCard).toBeTruthy();
    expect(incidenciasCard).toBeTruthy();
    expect(coberturaCard).toBeTruthy();
  });

  it('should filter services when selecting a specific shift', () => {
    component.setShift('Vespertino');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('[data-testid^="row-service-"]');
    expect(rows.length).toBe(2);
  });

  it('should display loading, empty, error and forbidden UI states when selected', () => {
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
});
