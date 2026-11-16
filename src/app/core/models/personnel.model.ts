import {
  DashboardApiError,
  DemoDataMetadata,
  KpiMetric,
  OperationalStatus,
  ShiftType,
  ViewStateStatus,
} from './executive-dashboard.model';

// ============================================================================
// SIGE-H — Modelos de Dominio: 2. Gestión de Personal (F2)
// Solo lectura demostrativa: plantilla, adscripción, categoría nominal y función
// ============================================================================

export type EmploymentStatus =
  | 'Activo en Servicio'
  | 'Licencia / Comisión'
  | 'Incapacidad Temporal'
  | 'Vacaciones Programadas';

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

export interface InstitutionalAffiliation {
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly divisionName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly positionCodeDemo: string;
  readonly contractModalityDemo: 'Base Institucional (Demo)' | 'Guardia / Suplencia Institucional (Demo)';
  readonly baseShift: ShiftType | 'Jornada Acumulada';
  readonly scheduleScheme: ScheduleSchemeType;
  readonly seniorityYearsDemo: number;
}

export interface StaffMemberRecord {
  readonly employeeId: string;
  readonly employeeNumberDemo: string;
  readonly fullNameDemo: string;
  readonly nominalCategory: NominalCategory;
  readonly operationalFunction: OperationalFunction;
  readonly employmentStatus: EmploymentStatus;
  readonly statusSeverity: OperationalStatus;
  readonly affiliation: InstitutionalAffiliation;
  readonly professionalLicenseDemo: string;
  readonly specialtyTag: string;
  readonly lastRosterCheckDemo: string;
  readonly supervisorObservations: string;
}

export interface PersonnelQueryCriteria {
  readonly hospitalId?: string | 'ALL';
  readonly serviceId?: string | 'ALL';
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

export interface PersonnelDirectorySnapshot {
  readonly metadata: DemoDataMetadata;
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
