import {
  ExecutiveDashboardSnapshot,
  KpiMetric,
  OperationalIncident,
  ServiceCoverageItem,
  ShiftFilter,
} from '../models/executive-dashboard.model';
import {
  HospitalDivision,
  HospitalInstitution,
  HospitalServiceUnit,
  OrganizationExplorerSnapshot,
} from '../models/organization.model';
import {
  PersonnelDirectorySnapshot,
  PersonnelPaginationMeta,
  StaffMemberRecord,
} from '../models/personnel.model';
import {
  CoverageAlertItem,
  ScheduleSchemeSummary,
  WeeklyScheduleSnapshot,
  WeeklyStaffScheduleRow,
} from '../models/scheduling.model';

// ============================================================================
// SIGE-H — Contratos DTO OpenAPI v1 Verificados (`contracts/sigeh-v1.json`)
// y Funciones Explícitas de Transformación a Modelos de Dominio Angular (F3-B)
// ============================================================================

export const UNAVAILABLE_V1_FIELD_LABEL =
  'Información no disponible (proyección OpenAPI v1)' as const;

/**
 * Esquemas exactos de `contracts/sigeh-v1.json` -> `components.schemas`
 */
export interface LivenessResponseDto {
  readonly status: 'ok';
  readonly service: string;
  readonly timestamp: string;
}

export interface DatabaseHealthUpDto {
  readonly status: 'up';
  readonly schema: string;
  readonly schemaVerified: boolean;
  readonly latencyMs: number;
}

export interface HealthResponseDto {
  readonly status: 'ok';
  readonly service: string;
  readonly database: DatabaseHealthUpDto;
  readonly timestamp: string;
}

export interface DatabaseHealthDownDto {
  readonly status: 'down';
  readonly schema: string;
  readonly schemaVerified: boolean;
}

export interface HealthErrorResponseDto {
  readonly status: 'error';
  readonly service: string;
  readonly database: DatabaseHealthDownDto;
  readonly message: string;
  readonly timestamp: string;
}

export interface ApiVersionResponseDto {
  readonly apiVersion: string;
  readonly apiBasePath: string;
}

export interface OrganizationReferenceDto {
  readonly id: string;
  readonly hospitalId: string;
  readonly divisionId: string | null;
  readonly servicioId: string | null;
  readonly activo: boolean;
}

export interface OrganizationReferencePageDto {
  readonly items: readonly OrganizationReferenceDto[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export interface OrganizationReferenceQueryParams {
  readonly hospitalId?: string;
  readonly divisionId?: string;
  readonly servicioId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Transformación explícita de `OrganizationReferenceDto` (GET `/api/v1/hospitales`)
 * hacia `HospitalInstitution`.
 * No inventa nombres ni claves reales: expone únicamente `id`, `hospitalId` y `activo`
 * e identifica explícitamente los campos descriptivos pendientes de privilegios SQL.
 */
export function mapOrganizationReferenceToHospital(
  dto: OrganizationReferenceDto,
  divisionsCount = 0,
  servicesCount = 0,
): HospitalInstitution {
  return {
    hospitalId: dto.hospitalId,
    hospitalCode: 'Sin clave (v1)',
    hospitalName: `Hospital ID: ${dto.hospitalId} (Nombre no disponible en proyección v1)`,
    levelCode: UNAVAILABLE_V1_FIELD_LABEL,
    regionDemo: 'Zona horaria / región no disponible en contrato v1',
    nursingDirectorDemo: UNAVAILABLE_V1_FIELD_LABEL,
    divisionsCount,
    servicesCount,
    activeStaffTotal: null,
    activoContractFlag: dto.activo,
    isLimitedProjection: true,
  };
}

/**
 * Transformación explícita de `OrganizationReferenceDto`
 * (GET `/api/v1/hospitales/{hospitalId}/divisiones`) hacia `HospitalDivision`.
 */
export function mapOrganizationReferenceToDivision(
  dto: OrganizationReferenceDto,
  servicesCount = 0,
): HospitalDivision {
  const effectiveDivisionId = dto.divisionId ?? dto.id;
  return {
    divisionId: effectiveDivisionId,
    divisionCode: 'Sin clave (v1)',
    divisionName: `División ID: ${effectiveDivisionId} (Nombre no disponible en proyección v1)`,
    hospitalId: dto.hospitalId,
    divisionChiefDemo: UNAVAILABLE_V1_FIELD_LABEL,
    servicesCount,
    totalAuthorizedStaff: null,
    totalActiveStaff: null,
    activoContractFlag: dto.activo,
    isLimitedProjection: true,
  };
}

/**
 * Transformación explícita de `OrganizationReferenceDto` (GET `/api/v1/servicios`)
 * hacia `HospitalServiceUnit`.
 * Emplea estados de información no disponible para ubicación, turnos y responsables.
 */
export function mapOrganizationReferenceToService(
  dto: OrganizationReferenceDto,
): HospitalServiceUnit {
  const effectiveServiceId = dto.servicioId ?? dto.id;
  const effectiveDivisionId = dto.divisionId ?? 'SIN-DIVISION-V1';

  return {
    serviceId: effectiveServiceId,
    serviceCode: 'Sin clave (v1)',
    serviceName: `Servicio ID: ${effectiveServiceId} (Nombre no disponible en proyección v1)`,
    hospitalId: dto.hospitalId,
    divisionId: effectiveDivisionId,
    divisionName: dto.divisionId
      ? `División ID: ${dto.divisionId}`
      : 'División no asignada en referencia v1',
    physicalLocation: UNAVAILABLE_V1_FIELD_LABEL,
    careModality: 'Información no disponible en contrato v1',
    authorizedPositions: null,
    activeStaffCount: null,
    enabledShifts: [],
    operationalStatus: dto.activo ? 'optimal' : 'warning',
    responsibles: [],
    operationalNotes: `Registro contractual v1 (id: ${dto.id}, activo: ${dto.activo ? 'Sí' : 'No'}). Los campos descriptivos (nombre, clave, ubicación, turnos y responsables) no están incluidos en la proyección actual por privilegios SQL pendientes.`,
    activoContractFlag: dto.activo,
    isLimitedProjection: true,
  };
}

export interface OrganizationPagesBundle {
  readonly hospitalsPage: OrganizationReferencePageDto;
  readonly divisionsPage: OrganizationReferencePageDto;
  readonly servicesPage: OrganizationReferencePageDto;
  readonly selectedHospitalId?: string;
  readonly selectedServiceId?: string;
}

/**
 * Combina las páginas verificadas de `/api/v1/hospitales`,
 * `/api/v1/hospitales/{hospitalId}/divisiones` y `/api/v1/servicios` en el
 * modelo `OrganizationExplorerSnapshot` de la vista Angular.
 */
export function mapOrganizationReferencePagesToSnapshot(
  bundle: OrganizationPagesBundle,
): OrganizationExplorerSnapshot | null {
  if (bundle.hospitalsPage.items.length === 0) {
    return null;
  }

  const services = bundle.servicesPage.items.map((item) =>
    mapOrganizationReferenceToService(item),
  );

  const divisions = bundle.divisionsPage.items.map((divDto) => {
    const divId = divDto.divisionId ?? divDto.id;
    const countForDiv = services.filter((s) => s.divisionId === divId).length;
    return mapOrganizationReferenceToDivision(divDto, countForDiv);
  });

  const hospitals = bundle.hospitalsPage.items.map((hospDto) => {
    const isTarget =
      bundle.selectedHospitalId === hospDto.hospitalId ||
      (!bundle.selectedHospitalId &&
        hospDto.hospitalId === bundle.hospitalsPage.items[0].hospitalId);
    return mapOrganizationReferenceToHospital(
      hospDto,
      isTarget ? divisions.length : 0,
      isTarget ? services.length : 0,
    );
  });

  const selectedHospital =
    hospitals.find((h) => h.hospitalId === bundle.selectedHospitalId) ?? hospitals[0];

  const selectedService =
    services.find((s) => s.serviceId === bundle.selectedServiceId) ??
    services[0] ??
    null;

  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: 'SIGEH-OPENAPI-V1-ORG-PROJECTION',
      disclaimer:
        'Datos recibidos del contrato OpenAPI v1 (/api/v1/hospitales, /divisiones, /servicios) con proyección limitada a identificadores jerárquicos y estado activo.',
      simulatedHospitalUnit: `Hospital UUID ${selectedHospital.hospitalId}`,
      simulatedRole: 'Sesión Autorizada CATALOGOS_ADMINISTRAR (Contrato v1)',
      generatedAtIso: new Date().toISOString(),
    },
    projectionMode: 'OPENAPI_V1_IDENTIFIERS_ONLY',
    cursorPagination: {
      nextCursor: bundle.servicesPage.nextCursor,
      limit: bundle.servicesPage.limit,
      order: bundle.servicesPage.order,
    },
    hospitals,
    selectedHospital,
    divisions,
    services,
    selectedService,
  };
}

// ============================================================================
// Contratos DTO preparados en F3-A para módulos aún pendientes en backend v1
// ============================================================================

export interface OpenApiSourceMetaDto {
  readonly datasetCode?: string;
  readonly hospitalUnitName?: string;
  readonly activeRoleLabel?: string;
  readonly generatedAtIso: string;
}

export interface ExecutiveDashboardOpenApiDto {
  readonly sourceMeta: OpenApiSourceMetaDto;
  readonly activeShift: ShiftFilter;
  readonly kpis: readonly KpiMetric[];
  readonly serviceCoverage: readonly ServiceCoverageItem[];
  readonly attendance: ExecutiveDashboardSnapshot['attendance'];
  readonly incidents: readonly OperationalIncident[];
}

export interface OrganizationExplorerOpenApiDto {
  readonly sourceMeta: OpenApiSourceMetaDto;
  readonly hospitals: readonly HospitalInstitution[];
  readonly selectedHospital: HospitalInstitution;
  readonly divisions: readonly HospitalDivision[];
  readonly services: readonly HospitalServiceUnit[];
  readonly selectedService: HospitalServiceUnit | null;
}

export interface PersonnelDirectoryOpenApiDto {
  readonly sourceMeta: OpenApiSourceMetaDto;
  readonly indicators: readonly KpiMetric[];
  readonly items: readonly StaffMemberRecord[];
  readonly pagination: PersonnelPaginationMeta;
  readonly selectedEmployee: StaffMemberRecord | null;
  readonly availableHospitals: ReadonlyArray<{ id: string; name: string }>;
  readonly availableServices: ReadonlyArray<{ id: string; name: string; hospitalId: string }>;
}

export interface WeeklyScheduleOpenApiDto {
  readonly sourceMeta: OpenApiSourceMetaDto;
  readonly weekRangeLabel: string;
  readonly weekDaysHeader: WeeklyScheduleSnapshot['weekDaysHeader'];
  readonly schemeSummaries: readonly ScheduleSchemeSummary[];
  readonly rows: readonly WeeklyStaffScheduleRow[];
  readonly coverageAlerts: readonly CoverageAlertItem[];
  readonly availableHospitals: ReadonlyArray<{ id: string; name: string }>;
  readonly availableServices: ReadonlyArray<{ id: string; name: string; hospitalId: string }>;
}

export function mapExecutiveDashboardDtoToDomain(
  dto: ExecutiveDashboardOpenApiDto,
): ExecutiveDashboardSnapshot {
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: dto.sourceMeta.datasetCode ?? 'SIGEH-OPENAPI-DASHBOARD',
      disclaimer: 'Datos provistos mediante contrato OpenAPI verificado.',
      simulatedHospitalUnit: dto.sourceMeta.hospitalUnitName ?? 'Unidad Hospitalaria SIGE-H',
      simulatedRole: dto.sourceMeta.activeRoleLabel ?? 'Supervisión / Jefatura',
      generatedAtIso: dto.sourceMeta.generatedAtIso,
    },
    activeShift: dto.activeShift,
    kpis: dto.kpis,
    serviceCoverage: dto.serviceCoverage,
    attendance: dto.attendance,
    incidents: dto.incidents,
  };
}

export function mapOrganizationExplorerDtoToDomain(
  dto: OrganizationExplorerOpenApiDto,
): OrganizationExplorerSnapshot {
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: dto.sourceMeta.datasetCode ?? 'SIGEH-OPENAPI-ORG',
      disclaimer: 'Catálogo organizacional provisto mediante contrato OpenAPI.',
      simulatedHospitalUnit: dto.sourceMeta.hospitalUnitName ?? 'Red Hospitalaria SIGE-H',
      simulatedRole: dto.sourceMeta.activeRoleLabel ?? 'Supervisión / Jefatura',
      generatedAtIso: dto.sourceMeta.generatedAtIso,
    },
    hospitals: dto.hospitals,
    selectedHospital: dto.selectedHospital,
    divisions: dto.divisions,
    services: dto.services,
    selectedService: dto.selectedService,
  };
}

export function mapPersonnelDirectoryDtoToDomain(
  dto: PersonnelDirectoryOpenApiDto,
): PersonnelDirectorySnapshot {
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: dto.sourceMeta.datasetCode ?? 'SIGEH-OPENAPI-PERSONNEL',
      disclaimer: 'Padrón nominal provisto mediante contrato OpenAPI.',
      simulatedHospitalUnit: dto.sourceMeta.hospitalUnitName ?? 'Plantilla SIGE-H',
      simulatedRole: dto.sourceMeta.activeRoleLabel ?? 'Supervisión / Jefatura',
      generatedAtIso: dto.sourceMeta.generatedAtIso,
    },
    indicators: dto.indicators,
    items: dto.items,
    pagination: dto.pagination,
    selectedEmployee: dto.selectedEmployee,
    availableHospitals: dto.availableHospitals,
    availableServices: dto.availableServices,
  };
}

export function mapWeeklyScheduleDtoToDomain(
  dto: WeeklyScheduleOpenApiDto,
): WeeklyScheduleSnapshot {
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: dto.sourceMeta.datasetCode ?? 'SIGEH-OPENAPI-SCHEDULE',
      disclaimer: 'Programación semanal provista mediante contrato OpenAPI.',
      simulatedHospitalUnit: dto.sourceMeta.hospitalUnitName ?? 'Programación SIGE-H',
      simulatedRole: dto.sourceMeta.activeRoleLabel ?? 'Supervisión / Jefatura',
      generatedAtIso: dto.sourceMeta.generatedAtIso,
    },
    weekRangeLabel: dto.weekRangeLabel,
    weekDaysHeader: dto.weekDaysHeader,
    schemeSummaries: dto.schemeSummaries,
    rows: dto.rows,
    coverageAlerts: dto.coverageAlerts,
    availableHospitals: dto.availableHospitals,
    availableServices: dto.availableServices,
  };
}
