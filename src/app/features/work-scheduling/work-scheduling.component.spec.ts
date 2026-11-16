import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SyntheticSchedulingAdapter } from '../../core/adapters/synthetic-scheduling.adapter';
import { SCHEDULING_GATEWAY } from '../../core/ports/scheduling.gateway';
import { WorkSchedulingComponent } from './work-scheduling.component';

describe('WorkSchedulingComponent (F2)', () => {
  let component: WorkSchedulingComponent;
  let fixture: ComponentFixture<WorkSchedulingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkSchedulingComponent],
      providers: [
        {
          provide: SCHEDULING_GATEWAY,
          useExisting: SyntheticSchedulingAdapter,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkSchedulingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render scheme summaries, weekly calendar table and coverage alerts', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="scheduling-schemes-grid"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="weekly-schedule-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="scheduling-alerts-section"]')).toBeTruthy();
  });

  it('should filter by schedule scheme and handle loading/error states', () => {
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
});
