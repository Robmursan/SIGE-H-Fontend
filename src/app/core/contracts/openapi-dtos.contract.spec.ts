import {
  mapExecutiveDashboardDtoToDomain,
  mapOrganizationExplorerDtoToDomain,
  mapOrganizationReferencePagesToSnapshot,
  mapOrganizationReferenceToDivision,
  mapOrganizationReferenceToHospital,
  mapOrganizationReferenceToService,
  mapPersonnelDirectoryDtoToDomain,
  mapWeeklyScheduleDtoToDomain,
  UNAVAILABLE_V1_FIELD_LABEL,
} from './openapi-dtos.contract';

describe('OpenAPI DTO to Domain Mappers (F3-A & F3-B Anti-Corruption Layer)', () => {
  it('should map OpenAPI v1 OrganizationReferenceDto (identifiers-hierarchy-active-only) without inventing fields', () => {
    const hospitalId = '0195f7e2-56dc-7f95-9e08-799c039eb201';
    const divisionId = '0195f7e2-56dc-7f95-9e08-799c039eb202';
    const servicioId = '0195f7e2-56dc-7f95-9e08-799c039eb203';

    const hospital = mapOrganizationReferenceToHospital(
      { id: hospitalId, hospitalId, divisionId: null, servicioId: null, activo: true },
      1,
      1,
    );
    expect(hospital.hospitalId).toBe(hospitalId);
    expect(hospital.isLimitedProjection).toBe(true);
    expect(hospital.activeStaffTotal).toBeNull();
    expect(hospital.nursingDirectorDemo).toBe(UNAVAILABLE_V1_FIELD_LABEL);

    const division = mapOrganizationReferenceToDivision(
      { id: divisionId, hospitalId, divisionId, servicioId: null, activo: true },
      1,
    );
    expect(division.divisionId).toBe(divisionId);
    expect(division.divisionChiefDemo).toBe(UNAVAILABLE_V1_FIELD_LABEL);

    const service = mapOrganizationReferenceToService({
      id: servicioId,
      hospitalId,
      divisionId,
      servicioId,
      activo: false,
    });
    expect(service.serviceId).toBe(servicioId);
    expect(service.operationalStatus).toBe('warning');
    expect(service.authorizedPositions).toBeNull();
    expect(service.activeStaffCount).toBeNull();
    expect(service.enabledShifts).toEqual([]);
    expect(service.responsibles).toEqual([]);

    const snapshot = mapOrganizationReferencePagesToSnapshot({
      hospitalsPage: {
        items: [{ id: hospitalId, hospitalId, divisionId: null, servicioId: null, activo: true }],
        nextCursor: null,
        limit: 50,
        order: 'id:asc',
      },
      divisionsPage: {
        items: [{ id: divisionId, hospitalId, divisionId, servicioId: null, activo: true }],
        nextCursor: null,
        limit: 50,
        order: 'id:asc',
      },
      servicesPage: {
        items: [{ id: servicioId, hospitalId, divisionId, servicioId, activo: true }],
        nextCursor: '0195f7e2-56dc-7f95-9e08-799c039eb299',
        limit: 50,
        order: 'id:asc',
      },
      selectedHospitalId: hospitalId,
      selectedServiceId: servicioId,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.metadata.isSyntheticDemo).toBe(false);
    expect(snapshot?.metadata.datasetCode).toBe('SIGEH-OPENAPI-V1-ORG-PROJECTION');
    expect(snapshot?.cursorPagination?.nextCursor).toBe(
      '0195f7e2-56dc-7f95-9e08-799c039eb299',
    );
  });

  it('should map OpenAPI DTOs to clean domain snapshots with isSyntheticDemo = false', () => {
    const dashSnap = mapExecutiveDashboardDtoToDomain({
      sourceMeta: {
        datasetCode: 'OPENAPI-V1',
        generatedAtIso: '2026-11-15T16:30:00.000Z',
      },
      activeShift: 'Matutino',
      kpis: [],
      serviceCoverage: [],
      attendance: {
        totalScheduled: 10,
        totalPresent: 10,
        punctualityPercentage: 100,
        justifiedAbsences: 0,
        unjustifiedAbsences: 0,
        activeSubstitutions: 0,
        delayedCheckIns: 0,
        categories: [],
      },
      incidents: [],
    });

    expect(dashSnap.metadata.isSyntheticDemo).toBe(false);
    expect(dashSnap.metadata.datasetCode).toBe('OPENAPI-V1');

    const orgSnap = mapOrganizationExplorerDtoToDomain({
      sourceMeta: { generatedAtIso: '2026-11-15T16:30:00.000Z' },
      hospitals: [],
      selectedHospital: {
        hospitalId: 'H1',
        hospitalCode: 'HC1',
        hospitalName: 'Hospital Test',
        levelCode: 'N3',
        regionDemo: 'Norte',
        nursingDirectorDemo: 'Dir',
        divisionsCount: 1,
        servicesCount: 1,
        activeStaffTotal: 10,
      },
      divisions: [],
      services: [],
      selectedService: null,
    });
    expect(orgSnap.metadata.isSyntheticDemo).toBe(false);

    const persSnap = mapPersonnelDirectoryDtoToDomain({
      sourceMeta: { generatedAtIso: '2026-11-15T16:30:00.000Z' },
      indicators: [],
      items: [],
      pagination: {
        currentPage: 1,
        pageSize: 5,
        totalItems: 0,
        totalPages: 1,
        startItemIndex: 0,
        endItemIndex: 0,
      },
      selectedEmployee: null,
      availableHospitals: [],
      availableServices: [],
    });
    expect(persSnap.metadata.isSyntheticDemo).toBe(false);

    const schedSnap = mapWeeklyScheduleDtoToDomain({
      sourceMeta: { generatedAtIso: '2026-11-15T16:30:00.000Z' },
      weekRangeLabel: 'Semana Test',
      weekDaysHeader: [],
      schemeSummaries: [],
      rows: [],
      coverageAlerts: [],
      availableHospitals: [],
      availableServices: [],
    });
    expect(schedSnap.metadata.isSyntheticDemo).toBe(false);
  });
});
