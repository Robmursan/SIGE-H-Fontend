import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SyntheticExecutiveDashboardAdapter } from './synthetic-executive-dashboard.adapter';

describe('SyntheticExecutiveDashboardAdapter', () => {
  let adapter: SyntheticExecutiveDashboardAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(SyntheticExecutiveDashboardAdapter);
  });

  it('should explicitly identify itself as a synthetic demo adapter', () => {
    expect(adapter.isSyntheticDemo).toBe(true);
    expect(adapter.adapterName).toContain('SyntheticDemoExecutiveAdapter');
  });

  it('should return ready state with 4 executive KPIs, service coverage, attendance and incidents', async () => {
    const result = await firstValueFrom(adapter.queryDashboard({ shift: 'ALL' }));

    expect(result.state).toBe('ready');
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.metadata.isSyntheticDemo).toBe(true);
    expect(result.snapshot?.kpis.length).toBe(4);
    expect(result.snapshot?.serviceCoverage.length).toBeGreaterThan(0);
    expect(result.snapshot?.incidents.length).toBeGreaterThan(0);
    expect(result.snapshot?.attendance.categories.length).toBe(4);
  });

  it('should filter services and incidents by shift (Matutino)', async () => {
    const result = await firstValueFrom(adapter.queryDashboard({ shift: 'Matutino' }));

    expect(result.state).toBe('ready');
    const services = result.snapshot?.serviceCoverage ?? [];
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((s) => s.shift === 'Matutino')).toBe(true);
  });

  it('should return empty state when search query matches no synthetic records', async () => {
    const result = await firstValueFrom(
      adapter.queryDashboard({ serviceQuery: 'SERVICIO_INEXISTENTE_XYZ_999' }),
    );

    expect(result.state).toBe('empty');
    expect(result.snapshot?.serviceCoverage.length).toBe(0);
  });

  it('should simulate loading, error, and forbidden states accurately', async () => {
    const loadingRes = await firstValueFrom(
      adapter.queryDashboard({ simulatedState: 'loading' }),
    );
    expect(loadingRes.state).toBe('loading');

    const errorRes = await firstValueFrom(adapter.queryDashboard({ simulatedState: 'error' }));
    expect(errorRes.state).toBe('error');
    expect(errorRes.error?.code).toBe('SYNTHETIC_SIMULATED_ERROR');

    const forbiddenRes = await firstValueFrom(
      adapter.queryDashboard({ simulatedState: 'forbidden' }),
    );
    expect(forbiddenRes.state).toBe('forbidden');
    expect(forbiddenRes.error?.code).toBe('FORBIDDEN_ROLE');
  });
});
