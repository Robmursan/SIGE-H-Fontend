import {
  DashboardApiError,
  DemoDataMetadata,
  OperationalStatus,
  ShiftType,
  ViewStateStatus,
} from './executive-dashboard.model';

// ============================================================================
// SIGE-H — Modelos de Dominio: 1. Organización Hospitalaria (F2 / F3-B)
// Jerarquía institucional: Hospital -> División -> Servicio Clínico
// Soporta tanto el modo sintético completo como la proyección limitada de
// OpenAPI v1 (`x-sigeh-projection: identifiers-hierarchy-active-only`).
// ============================================================================

export interface ServiceResponsible {
  readonly roleTitle:
    | 'Jefatura de Servicio'
    | 'Supervisión Matutina'
    | 'Supervisión Vespertina'
    | 'Supervisión Nocturna';
  readonly syntheticName: string;
  readonly employeeCode: string;
  readonly shiftScope: ShiftType | 'Jornada Acumulada' | 'Coordinación General';
  readonly extensionDemo: string;
}

export interface HospitalServiceUnit {
  readonly serviceId: string;
  readonly serviceCode: string;
  readonly serviceName: string;
  readonly hospitalId: string;
  readonly divisionId: string;
  readonly divisionName: string;
  readonly physicalLocation: string;
  readonly careModality:
    | 'Hospitalización Continua 24h'
    | 'Unidad Crítica'
    | 'Quirúrgico'
    | 'Ambulatorio y Urgencias'
    | 'Información no disponible en contrato v1';
  readonly authorizedPositions: number | null;
  readonly activeStaffCount: number | null;
  readonly enabledShifts: readonly (ShiftType | 'Jornada Acumulada')[];
  readonly operationalStatus: OperationalStatus;
  readonly responsibles: readonly ServiceResponsible[];
  readonly operationalNotes: string;
  readonly activoContractFlag?: boolean;
  readonly isLimitedProjection?: boolean;
}

export interface HospitalDivision {
  readonly divisionId: string;
  readonly divisionCode: string;
  readonly divisionName: string;
  readonly hospitalId: string;
  readonly divisionChiefDemo: string;
  readonly servicesCount: number;
  readonly totalAuthorizedStaff: number | null;
  readonly totalActiveStaff: number | null;
  readonly activoContractFlag?: boolean;
  readonly isLimitedProjection?: boolean;
}

export interface HospitalInstitution {
  readonly hospitalId: string;
  readonly hospitalCode: string;
  readonly hospitalName: string;
  readonly levelCode: string;
  readonly regionDemo: string;
  readonly nursingDirectorDemo: string;
  readonly divisionsCount: number;
  readonly servicesCount: number;
  readonly activeStaffTotal: number | null;
  readonly activoContractFlag?: boolean;
  readonly isLimitedProjection?: boolean;
}

export interface OrganizationQueryCriteria {
  readonly hospitalId?: string;
  readonly divisionId?: string | 'ALL';
  readonly servicioId?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly searchQuery?: string;
  readonly statusFilter?: 'ALL' | OperationalStatus;
  readonly selectedServiceId?: string;
  readonly simulatedState?: ViewStateStatus;
}

export interface OrganizationCursorPaginationMeta {
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export interface OrganizationExplorerSnapshot {
  readonly metadata: DemoDataMetadata;
  readonly projectionMode?: 'SYNTHETIC_FULL_DEMO' | 'OPENAPI_V1_IDENTIFIERS_ONLY';
  readonly cursorPagination?: OrganizationCursorPaginationMeta;
  readonly hospitals: readonly HospitalInstitution[];
  readonly selectedHospital: HospitalInstitution;
  readonly divisions: readonly HospitalDivision[];
  readonly services: readonly HospitalServiceUnit[];
  readonly selectedService: HospitalServiceUnit | null;
}

export interface OrganizationQueryResult {
  readonly state: ViewStateStatus;
  readonly snapshot: OrganizationExplorerSnapshot | null;
  readonly error: DashboardApiError | null;
}
