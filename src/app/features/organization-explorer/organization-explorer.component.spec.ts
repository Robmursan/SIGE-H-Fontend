import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SyntheticOrganizationAdapter } from '../../core/adapters/synthetic-organization.adapter';
import { ORGANIZATION_GATEWAY } from '../../core/ports/organization.gateway';
import { OrganizationExplorerComponent } from './organization-explorer.component';

describe('OrganizationExplorerComponent (F2)', () => {
  let component: OrganizationExplorerComponent;
  let fixture: ComponentFixture<OrganizationExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizationExplorerComponent],
      providers: [
        {
          provide: ORGANIZATION_GATEWAY,
          useExisting: SyntheticOrganizationAdapter,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render hospital selector, services table and service detail with responsibles', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="select-hospital"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="org-services-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="service-detail-panel"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="service-responsibles-list"]')).toBeTruthy();
  });

  it('should switch hospital and update divisions and services', () => {
    component.selectHospital('HOSP-DEMO-02');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="selected-hospital-card"]')?.textContent).toContain(
      'HEMP-SINT-02',
    );
  });

  it('should render loading, empty, error and forbidden states', () => {
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

  it('should render unavailable field notices when displaying a service from OpenAPI v1 limited projection', () => {
    const currentSnap = component['queryResult']().snapshot;
    expect(currentSnap).toBeTruthy();
    if (!currentSnap || !currentSnap.selectedService) {
      return;
    }

    component['queryResult'].set({
      state: 'ready',
      error: null,
      snapshot: {
        ...currentSnap,
        projectionMode: 'OPENAPI_V1_IDENTIFIERS_ONLY',
        selectedService: {
          ...currentSnap.selectedService,
          physicalLocation: 'Información no disponible (proyección OpenAPI v1)',
          authorizedPositions: null,
          activeStaffCount: null,
          enabledShifts: [],
          responsibles: [],
          isLimitedProjection: true,
        },
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="shifts-unavailable-notice"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="responsibles-unavailable-notice"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="detail-physical-location"]')?.textContent).toContain(
      'Información no disponible (proyección OpenAPI v1)',
    );
  });
});
