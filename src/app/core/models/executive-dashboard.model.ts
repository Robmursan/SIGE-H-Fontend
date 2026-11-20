// ============================================================================
// SIGE-H — Modelos de Dominio y Contratos Tipados del Dashboard Ejecutivo (F1)
// ============================================================================

export type ViewStateStatus = 'ready' | 'loading' | 'empty' | 'error' | 'forbidden';

export type OperationalStatus = 'optimal' | 'warning' | 'critical';

export type ShiftType = 'Matutino' | 'Vespertino' | 'Nocturno';

export type ShiftFilter = 'ALL' | ShiftType;

export type KpiCategory = 'personal' | 'asistencia' | 'incidencias' | 'cobertura';

export interface DemoDataMetadata {
  readonly isSyntheticDemo: boolean;
  readonly datasetCode: string;
  readonly disclaimer: string;
  readonly simulatedHospitalUnit: string;
  readonly simulatedRole: string;
  readonly generatedAtIso: string;
}

export interface KpiMetric {
  readonly id: string;
  readonly category: KpiCategory;
  readonly label: string;
  readonly value: number;
  readonly formattedValue: string;
  readonly unit: string;
  readonly targetLabel: string;
  readonly compliancePercentage: number;
  readonly deltaLabel: string;
  readonly trendDirection: 'up' | 'down' | 'neutral';
  readonly status: OperationalStatus;
  readonly summary: string;
}

export interface ServiceCoverageItem {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly floorOrWing: string;
  readonly shift: ShiftType;
  readonly requiredStaff: number;
  readonly assignedStaff: number;
  readonly presentStaff: number;
  readonly coveragePercentage: number;
  readonly status: OperationalStatus;
  readonly activeIncidentsCount: number;
  readonly supervisorNote: string;
}

export interface StaffCategoryBreakdown {
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly scheduledCount: number;
  readonly presentCount: number;
  readonly availabilityPercentage: number;
  readonly status: OperationalStatus;
}

export interface AttendanceSummary {
  readonly totalScheduled: number;
  readonly totalPresent: number;
  readonly punctualityPercentage: number;
  readonly justifiedAbsences: number;
  readonly unjustifiedAbsences: number;
  readonly activeSubstitutions: number;
  readonly delayedCheckIns: number;
  readonly categories: readonly StaffCategoryBreakdown[];
}

export type IncidentSeverity = 'high' | 'medium' | 'low';

export interface OperationalIncident {
  readonly incidentId: string;
  readonly category:
    | 'Descubierto de Turno'
    | 'Incapacidad Médica'
    | 'Retardo Operativo'
    | 'Falta Injustificada'
    | 'Permiso Económico';
  readonly severity: IncidentSeverity;
  readonly serviceName: string;
  readonly shift: ShiftType;
  readonly reportedTime: string;
  readonly resolutionStatus: 'Pendiente de Cobertura' | 'Suplencia Asignada' | 'En Revisión Jefatura';
  readonly summary: string;
}

export type CoordinationDashboardSemanticBase = 'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA';

export interface CoordinationProgrammingIndicators {
  readonly base: CoordinationDashboardSemanticBase;
  readonly jornadas: number;
  readonly empleadosProgramados: number;
  readonly programadas: number;
  readonly canceladas: number;
  readonly sustituidas: number;
  readonly cerradas: number;
  readonly horasPersonaProgramadas: number;
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly divisionId: string | null;
  readonly desde: string;
  readonly hasta: string;
}

export interface ExecutiveDashboardSnapshot {
  readonly metadata: DemoDataMetadata;
  readonly projectionMode?: 'SYNTHETIC_FULL_DEMO' | 'OPENAPI_V1_PROGRAMMING_INDICATORS';
  readonly programmingIndicators?: CoordinationProgrammingIndicators;
  readonly activeShift: ShiftFilter;
  readonly kpis: readonly KpiMetric[];
  readonly serviceCoverage: readonly ServiceCoverageItem[];
  readonly attendance: AttendanceSummary;
  readonly incidents: readonly OperationalIncident[];
}

export interface DashboardQueryCriteria {
  readonly hospitalId?: string;
  readonly divisionId?: string;
  readonly servicioId?: string;
  readonly desde?: string;
  readonly hasta?: string;
  readonly shift?: ShiftFilter;
  readonly serviceQuery?: string;
  readonly statusFilter?: 'ALL' | OperationalStatus;
  readonly simulatedState?: ViewStateStatus;
}

export type DashboardApiErrorCode =
  | 'BAD_REQUEST_VALIDATION'
  | 'UNAUTHORIZED_SESSION'
  | 'FORBIDDEN_ROLE'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT_STATE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_DISABLED_OR_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'OPENAPI_NOT_CONFIGURED'
  | 'ENDPOINT_PENDING_IN_OPENAPI_V1'
  | 'SYNTHETIC_SIMULATED_ERROR';

export interface DashboardApiError {
  readonly code: DashboardApiErrorCode;
  readonly httpStatus?: number;
  readonly title: string;
  readonly message: string;
  readonly requiredRoleHint?: string;
  readonly retryAfterSeconds?: number;
  readonly timestampIso: string;
}

export interface DashboardQueryResult {
  readonly state: ViewStateStatus;
  readonly snapshot: ExecutiveDashboardSnapshot | null;
  readonly error: DashboardApiError | null;
}
