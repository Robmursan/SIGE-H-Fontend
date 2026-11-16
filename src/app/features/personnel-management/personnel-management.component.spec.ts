import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SyntheticPersonnelAdapter } from '../../core/adapters/synthetic-personnel.adapter';
import { PERSONNEL_GATEWAY } from '../../core/ports/personnel.gateway';
import { PersonnelManagementComponent } from './personnel-management.component';

describe('PersonnelManagementComponent (F2)', () => {
  let component: PersonnelManagementComponent;
  let fixture: ComponentFixture<PersonnelManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonnelManagementComponent],
      providers: [
        {
          provide: PERSONNEL_GATEWAY,
          useExisting: SyntheticPersonnelAdapter,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonnelManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render plantilla KPIs, paginated personnel table and employee detail panel', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="personnel-kpi-grid"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="personnel-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="employee-detail-panel"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="personnel-pagination"]')).toBeTruthy();
  });

  it('should navigate pages and update selected employee detail', () => {
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
});
