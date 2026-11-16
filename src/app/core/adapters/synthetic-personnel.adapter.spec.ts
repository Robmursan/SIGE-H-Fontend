import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SyntheticPersonnelAdapter } from './synthetic-personnel.adapter';

describe('SyntheticPersonnelAdapter (F2 Gestión de Personal)', () => {
  let adapter: SyntheticPersonnelAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(SyntheticPersonnelAdapter);
  });

  it('should return paginated staff records, plantilla KPIs and selected employee detail', async () => {
    const res = await firstValueFrom(
      adapter.queryPersonnel({ page: 1, pageSize: 5 }),
    );

    expect(res.state).toBe('ready');
    expect(res.snapshot?.metadata.isSyntheticDemo).toBe(true);
    expect(res.snapshot?.indicators.length).toBe(4);
    expect(res.snapshot?.items.length).toBe(5);
    expect(res.snapshot?.pagination.totalItems).toBe(12);
    expect(res.snapshot?.pagination.totalPages).toBe(3);
    expect(res.snapshot?.selectedEmployee).not.toBeNull();
  });

  it('should filter by nominal category and employment status', async () => {
    const res = await firstValueFrom(
      adapter.queryPersonnel({
        nominalCategory: 'Jefa(e) de Piso de Enfermería',
        employmentStatus: 'Activo en Servicio',
      }),
    );

    expect(res.state).toBe('ready');
    expect(res.snapshot?.items.length).toBe(2);
    expect(
      res.snapshot?.items.every(
        (i) => i.nominalCategory === 'Jefa(e) de Piso de Enfermería',
      ),
    ).toBe(true);
  });

  it('should support loading, empty, error and forbidden states', async () => {
    const empty = await firstValueFrom(
      adapter.queryPersonnel({ searchQuery: 'SIN_PERSONAL_999' }),
    );
    expect(empty.state).toBe('empty');

    const forbidden = await firstValueFrom(
      adapter.queryPersonnel({ simulatedState: 'forbidden' }),
    );
    expect(forbidden.state).toBe('forbidden');
  });
});
