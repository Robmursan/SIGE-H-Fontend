import {
  DashboardApiError,
  DemoDataMetadata,
  KpiMetric,
  OperationalStatus,
  ShiftType,
  ViewStateStatus,
} from './executive-dashboard.model';

// ============================================================================
// SIGE-H — Modelos de Dominio: 2. Gestión de Personal y Adscripciones (F2 / F4-C)
// Soporta modo sintético completo (`SYNTHETIC_FULL_DEMO`) y proyección contractual
// OpenAPI v1 sin RUD (`OPENAPI_V1_SCOPED_STAFF`).
// ============================================================================

export type EmploymentStatus =
  | 'Activo en Servicio'
  | 'Licencia / Comisión'
  | 'Incapacidad Temporal'
  | 'Vacaciones Programadas'
  | 'Inactivo en Padrón';

export type NominalCategory =
  | 'Enfermera(o) Especialista C'
  | 'Enfermera(o) General Titulada(o) B'
  | 'Auxiliar de Enfermería General A'
  | 'Jefa(e) de Piso de Enfermería';

export type OperationalFunction =
  | 'Cuidado Crítico e Intensivo'
  | 'Enfermería Quirúrgica e Instrumentación'
  | 'Atención Clínica de Hospitalización'
  | 'Triage y Atención de Urgencias'
  | 'Supervisión Operativa de Piso';

export type ScheduleSchemeType =
  | 'Horario Diurno'
  | 'Jornada Acumulada'
  | 'Guardia Nocturna';

export type ContractAssignmentClase = 'NOMINAL' | 'OPERATIVA';

export interface InstitutionalAffiliation {
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly divisionName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly positionCodeDemo: string;
  readonly contractModalityDemo:
    | 'Base Institucional (Demo)'
    | 'Guardia / Suplencia Institucional (Demo)'
    | string;
  readonly baseShift: ShiftType | 'Jornada Acumulada' | string;
  readonly scheduleScheme: ScheduleSchemeType | string;
  readonly seniorityYearsDemo: number | null;
}

export interface StaffMemberRecord {
  readonly employeeId: string;
  readonly employeeNumberDemo: string;
  readonly fullNameDemo: string;
  readonly nominalCategory: NominalCategory | string;
  readonly operationalFunction: OperationalFunction | string;
  readonly employmentStatus: EmploymentStatus;
  readonly statusSeverity: OperationalStatus;
  readonly affiliation: InstitutionalAffiliation;
  readonly professionalLicenseDemo: string;
  readonly specialtyTag: string;
  readonly lastRosterCheckDemo: string;
  readonly supervisorObservations: string;
  /** Campos estrictos de proyección OpenAPI v1 (`EmployeeReadDto`) */
  readonly nombresContract?: string;
  readonly primerApellidoContract?: string;
  readonly activoContractFlag?: boolean;
  readonly isLimitedProjection?: boolean;
}

export interface PersonnelQueryCriteria {
  readonly hospitalId?: string | 'ALL';
  readonly divisionId?: string;
  readonly serviceId?: string | 'ALL';
  readonly fecha?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly nominalCategory?: NominalCategory | 'ALL';
  readonly employmentStatus?: EmploymentStatus | 'ALL';
  readonly searchQuery?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly selectedEmployeeId?: string;
  readonly simulatedState?: ViewStateStatus;
}

export interface PersonnelPaginationMeta {
  readonly currentPage: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly startItemIndex: number;
  readonly endItemIndex: number;
}

export interface PersonnelCursorPaginationMeta {
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export interface ContractAssignmentRecord {
  readonly adscripcionId: string;
  readonly contratoId: string;
  readonly servicioId: string;
  readonly clase: ContractAssignmentClase;
  readonly inicio: string;
  readonly fin: string | null;
}

export interface EmployeeDetailQueryCriteria {
  readonly empleadoId: string;
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly fecha: string;
  readonly divisionId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface EmployeeDetailView {
  readonly employee: StaffMemberRecord;
  readonly assignments: readonly ContractAssignmentRecord[];
  readonly assignmentsPagination: PersonnelCursorPaginationMeta;
  readonly distinctContractIds: readonly string[];
  readonly isLimitedProjection: boolean;
}

export interface EmployeeDetailQueryResult {
  readonly state: ViewStateStatus;
  readonly detail: EmployeeDetailView | null;
  readonly error: DashboardApiError | null;
}

export interface ContractAssignmentsQueryCriteria {
  readonly contratoId: string;
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly fecha: string;
  readonly divisionId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ContractAssignmentsQueryResult {
  readonly state: ViewStateStatus;
  readonly contratoId: string;
  readonly items: readonly ContractAssignmentRecord[];
  readonly cursorPagination: PersonnelCursorPaginationMeta | null;
  readonly error: DashboardApiError | null;
}

export interface PersonnelDirectorySnapshot {
  readonly metadata: DemoDataMetadata;
  readonly projectionMode?: 'SYNTHETIC_FULL_DEMO' | 'OPENAPI_V1_SCOPED_STAFF';
  readonly cursorPagination?: PersonnelCursorPaginationMeta;
  readonly effectiveQueryDate?: string;
  readonly indicators: readonly KpiMetric[];
  readonly items: readonly StaffMemberRecord[];
  readonly pagination: PersonnelPaginationMeta;
  readonly selectedEmployee: StaffMemberRecord | null;
  readonly availableHospitals: ReadonlyArray<{ id: string; name: string }>;
  readonly availableServices: ReadonlyArray<{ id: string; name: string; hospitalId: string }>;
}

export interface PersonnelQueryResult {
  readonly state: ViewStateStatus;
  readonly snapshot: PersonnelDirectorySnapshot | null;
  readonly error: DashboardApiError | null;
}
