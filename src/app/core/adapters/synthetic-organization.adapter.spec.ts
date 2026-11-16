import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SyntheticOrganizationAdapter } from './synthetic-organization.adapter';

describe('SyntheticOrganizationAdapter (F2 Organización Hospitalaria)', () => {
  let adapter: SyntheticOrganizationAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(SyntheticOrganizationAdapter);
  });

  it('should return hospital, divisions, services and selected service with responsibles', async () => {
    const res = await firstValueFrom(
      adapter.queryOrganization({ hospitalId: 'HOSP-DEMO-01' }),
    );

    expect(res.state).toBe('ready');
    expect(res.snapshot?.metadata.isSyntheticDemo).toBe(true);
    expect(res.snapshot?.hospitals.length).toBe(3);
    expect(res.snapshot?.selectedHospital.hospitalId).toBe('HOSP-DEMO-01');
    expect(res.snapshot?.divisions.length).toBe(3);
    expect(res.snapshot?.services.length).toBe(6);
    expect(res.snapshot?.selectedService?.responsibles.length).toBeGreaterThan(0);
  });

  it('should filter services by division and search query', async () => {
    const res = await firstValueFrom(
      adapter.queryOrganization({
        hospitalId: 'HOSP-DEMO-01',
        divisionId: 'DIV-DEMO-03',
        searchQuery: 'Quirófanos',
      }),
    );

    expect(res.state).toBe('ready');
    expect(res.snapshot?.services.length).toBe(1);
    expect(res.snapshot?.services[0].serviceCode).toBe('QUIR-201');
  });

  it('should support loading, empty, error and forbidden states', async () => {
    const loading = await firstValueFrom(
      adapter.queryOrganization({ simulatedState: 'loading' }),
    );
    expect(loading.state).toBe('loading');

    const empty = await firstValueFrom(
      adapter.queryOrganization({ searchQuery: 'INEXISTENTE_ORG_999' }),
    );
    expect(empty.state).toBe('empty');

    const error = await firstValueFrom(
      adapter.queryOrganization({ simulatedState: 'error' }),
    );
    expect(error.state).toBe('error');

    const forbidden = await firstValueFrom(
      adapter.queryOrganization({ simulatedState: 'forbidden' }),
    );
    expect(forbidden.state).toBe('forbidden');
  });
});
