import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SyntheticSchedulingAdapter } from './synthetic-scheduling.adapter';

describe('SyntheticSchedulingAdapter (F2 Programación Laboral)', () => {
  let adapter: SyntheticSchedulingAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(SyntheticSchedulingAdapter);
  });

  it('should return weekly 7-day calendar rows, 3 scheme summaries and coverage alerts', async () => {
    const res = await firstValueFrom(adapter.queryWeeklySchedule({}));

    expect(res.state).toBe('ready');
    expect(res.snapshot?.metadata.isSyntheticDemo).toBe(true);
    expect(res.snapshot?.weekDaysHeader.length).toBe(7);
    expect(res.snapshot?.schemeSummaries.length).toBe(3);
    expect(res.snapshot?.rows.length).toBeGreaterThan(0);
    expect(res.snapshot?.rows[0].days.length).toBe(7);
    expect(res.snapshot?.coverageAlerts.length).toBeGreaterThan(0);
  });

  it('should filter rows by schedule scheme (Guardia Nocturna)', async () => {
    const res = await firstValueFrom(
      adapter.queryWeeklySchedule({ schemeFilter: 'Guardia Nocturna' }),
    );

    expect(res.state).toBe('ready');
    const rows = res.snapshot?.rows ?? [];
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.scheduleScheme === 'Guardia Nocturna')).toBe(true);
  });

  it('should support loading and error states', async () => {
    const loading = await firstValueFrom(
      adapter.queryWeeklySchedule({ simulatedState: 'loading' }),
    );
    expect(loading.state).toBe('loading');

    const error = await firstValueFrom(
      adapter.queryWeeklySchedule({ simulatedState: 'error' }),
    );
    expect(error.state).toBe('error');
  });
});
