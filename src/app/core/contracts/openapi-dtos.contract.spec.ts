import {
  mapEmployeeDetailDtoToDomain,
  mapEmployeePageDtoToSnapshot,
  mapExecutiveDashboardDtoToDomain,
  mapOrganizationExplorerDtoToDomain,
  mapOrganizationReferencePagesToSnapshot,
  mapOrganizationReferenceToDivision,
  mapOrganizationReferenceToHospital,
  mapOrganizationReferenceToService,
  mapPaseListaPageDtoToSnapshot,
  mapPersonnelDirectoryDtoToDomain,
  mapProgrammingDashboardDtoToSnapshot,
  mapSchedulePageDtoToSnapshot,
  mapWeeklyScheduleDtoToDomain,
  UNAVAILABLE_V1_FIELD_LABEL,
  validateProgrammingWindow168h,
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

  it('should map L3B-2A EmployeePageDto and EmployeeDetailDto without inventing RUD or excluded columns (F4-C)', () => {
    const hospId = '11111111-1111-4111-8111-111111111111';
    const srvId = '22222222-2222-4222-8222-222222222222';
    const empId = '33333333-3333-4333-8333-333333333333';
    const adscId = '44444444-4444-4444-8444-444444444444';
    const contId = '55555555-5555-4555-8555-555555555555';

    const staffSnap = mapEmployeePageDtoToSnapshot(
      {
        items: [
          {
            empleadoId: empId,
            nombres: 'Ana María',
            primerApellido: 'López',
            activo: true,
          },
        ],
        nextCursor: empId,
        limit: 25,
        order: 'id:asc',
      },
      {
        hospitalId: hospId,
        servicioId: srvId,
        fecha: '2026-11-18',
        availableHospitals: [{ id: hospId, name: `Hospital UUID: ${hospId}` }],
        availableServices: [{ id: srvId, name: `Servicio UUID: ${srvId}`, hospitalId: hospId }],
      },
    );

    expect(staffSnap.metadata.isSyntheticDemo).toBe(false);
    expect(staffSnap.projectionMode).toBe('OPENAPI_V1_SCOPED_STAFF');
    expect(staffSnap.indicators).toEqual([]);
    expect(staffSnap.cursorPagination?.nextCursor).toBe(empId);
    expect(staffSnap.items[0].fullNameDemo).toBe('Ana María López');
    expect(staffSnap.items[0].employeeNumberDemo).toContain('sin RUD');
    expect(staffSnap.items[0].affiliation.seniorityYearsDemo).toBeNull();
    expect(staffSnap.items[0].isLimitedProjection).toBe(true);

    const detail = mapEmployeeDetailDtoToDomain(
      {
        empleado: {
          empleadoId: empId,
          nombres: 'Ana María',
          primerApellido: 'López',
          activo: false,
        },
        adscripciones: {
          items: [
            {
              adscripcionId: adscId,
              contratoId: contId,
              servicioId: srvId,
              clase: 'OPERATIVA',
              inicio: '2026-01-01',
              fin: null,
            },
          ],
          nextCursor: null,
          limit: 50,
          order: 'id:asc',
        },
      },
      { hospitalId: hospId, servicioId: srvId, fecha: '2026-11-18' },
    );

    expect(detail.employee.activoContractFlag).toBe(false);
    expect(detail.employee.employmentStatus).toBe('Inactivo en Padrón');
    expect(detail.assignments.length).toBe(1);
    expect(detail.assignments[0].fin).toBeNull();
    expect(detail.distinctContractIds).toEqual([contId]);
  });

  it('should enforce ISO-8601 timezone offset and 168h max window and map SchedulePageDto & ProgrammingDashboardDto without mixing synthetic attendance/coverage (F4-D)', () => {
    // Sin offset -> inválido
    expect(
      validateProgrammingWindow168h('2026-11-16T00:00:00', '2026-11-23T00:00:00').valid,
    ).toBe(false);
    // > 168h -> inválido
    expect(
      validateProgrammingWindow168h('2026-11-16T00:00:00-06:00', '2026-11-23T00:01:00-06:00')
        .valid,
    ).toBe(false);
    // Exactamente 168h con offset -> válido
    const validWin = validateProgrammingWindow168h(
      '2026-11-16T00:00:00-06:00',
      '2026-11-23T00:00:00-06:00',
    );
    expect(validWin.valid).toBe(true);
    expect(validWin.durationHours).toBe(168);

    const hospId = '11111111-1111-4111-8111-111111111111';
    const srvId = '22222222-2222-4222-8222-222222222222';
    const progId = '33333333-3333-4333-8333-333333333333';
    const empId = '44444444-4444-4444-8444-444444444444';

    const schedSnap = mapSchedulePageDtoToSnapshot(
      {
        items: [
          {
            programacionId: progId,
            empleadoId: empId,
            servicioId: srvId,
            horarioId: null,
            turnoCodigo: 'MAT',
            inicioProgramado: '2026-11-16T07:00:00-06:00',
            finProgramado: '2026-11-16T15:00:00-06:00',
            estado: 'PROGRAMADA',
          },
        ],
        nextCursor: progId,
        limit: 50,
        order: 'id:asc',
      },
      {
        hospitalId: hospId,
        servicioId: srvId,
        desde: '2026-11-16T00:00:00-06:00',
        hasta: '2026-11-23T00:00:00-06:00',
        availableHospitals: [],
        availableServices: [],
      },
    );
    expect(schedSnap.projectionMode).toBe('OPENAPI_V1_SCOPED_PROGRAMMING');
    expect(schedSnap.scopedItems?.length).toBe(1);
    expect(schedSnap.coverageAlerts).toEqual([]);

    const dashSnap = mapProgrammingDashboardDtoToSnapshot(
      {
        base: 'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA',
        jornadas: 42,
        empleadosProgramados: 18,
        programadas: 35,
        canceladas: 2,
        sustituidas: 3,
        cerradas: 2,
        horasPersonaProgramadas: 312.5,
      },
      {
        hospitalId: hospId,
        servicioId: srvId,
        desde: '2026-11-16T00:00:00-06:00',
        hasta: '2026-11-23T00:00:00-06:00',
      },
    );
    expect(dashSnap.metadata.isSyntheticDemo).toBe(false);
    expect(dashSnap.projectionMode).toBe('OPENAPI_V1_PROGRAMMING_INDICATORS');
    expect(dashSnap.programmingIndicators?.base).toBe('PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA');
    expect(dashSnap.programmingIndicators?.horasPersonaProgramadas).toBe(312.5);
    expect(dashSnap.kpis).toEqual([]);
    expect(dashSnap.serviceCoverage).toEqual([]);
    expect(dashSnap.incidents).toEqual([]);
  });

  it('should map CU-ASI-01/02 PaseListaPageDto preserving BIGINT decimal strings eventoId and revision (F4-F)', () => {
    const hospId = '11111111-1111-4111-8111-111111111111';
    const srvId = '22222222-2222-4222-8222-222222222222';
    const progId = '33333333-3333-4333-8333-333333333333';
    const empId = '44444444-4444-4444-8444-444444444444';
    const asiId = '55555555-5555-4555-8555-555555555555';
    const actorId = '66666666-6666-4666-8666-666666666666';

    const snap = mapPaseListaPageDtoToSnapshot({
      hospitalId: hospId,
      servicioId: srvId,
      fecha: '2026-11-18',
      zonaHoraria: 'America/Mexico_City',
      items: [
        {
          programacionId: progId,
          empleado: { empleadoId: empId, nombres: 'Sofía', primerApellido: 'Ramírez' },
          horarioId: null,
          turnoCodigo: 'MAT',
          inicioProgramado: '2026-11-18T07:00:00-06:00',
          finProgramado: '2026-11-18T15:00:00-06:00',
          estadoProgramacion: 'PROGRAMADA',
          capturada: true,
          asistenciaId: asiId,
          estadoOperativo: 'PRESENTE',
          validacionAdministrativa: 'PENDIENTE',
          revision: '9007199254740993123',
          ultimaCaptura: {
            eventoId: '9007199254740999999',
            actorId,
            registradoEn: '2026-11-18T07:10:00-06:00',
          },
          capturable: false,
          motivoNoCapturable: 'SIN_FACULTAD_CAPTURA',
        },
      ],
      nextCursor: progId,
      limit: 50,
      order: 'id:asc',
    });

    expect(snap.metadata.isSyntheticDemo).toBe(false);
    expect(snap.zonaHoraria).toBe('America/Mexico_City');
    expect(snap.items[0].estadoOperativo).toBe('PRESENTE');
    expect(snap.items[0].revision).toBe('9007199254740993123');
    expect(snap.items[0].ultimaCaptura?.eventoId).toBe('9007199254740999999');
    expect(snap.items[0].ultimaCaptura?.actorId).toBe(actorId);
    expect(snap.items[0].motivoNoCapturable).toBe('SIN_FACULTAD_CAPTURA');
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
