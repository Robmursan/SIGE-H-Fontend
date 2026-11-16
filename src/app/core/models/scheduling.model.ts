import {
  DashboardApiError,
  DemoDataMetadata,
  OperationalStatus,
  ShiftType,
  ViewStateStatus,
} from './executive-dashboard.model';
import { NominalCategory, ScheduleSchemeType } from './personnel.model';

// ============================================================================
// SIGE-H — Modelos de Dominio: 3. Programación Laboral Semanal (F2)
// Visualización de horarios diurnos, acumulados, guardias nocturnas y descansos
// ============================================================================

export type DayAssignmentType =
  | 'DIURNO_MATUTINO'
  | 'DIURNO_VESPERTINO'
  | 'GUARDIA_NOCTURNA'
  | 'JORNADA_ACUMULADA'
  | 'DESCANSO_POST_GUARDIA'
  | 'DESCANSO_PROGRAMADO'
  | 'INCIDENCIA_AUSENCIA';

export interface DailyScheduleCell {
  readonly dayIso: string;
  readonly dayShortLabel: string; // Lun, Mar, Mié, Jue, Vie, Sáb, Dom
  readonly dayNumberLabel: string; // 16 Nov, etc.
  readonly assignmentType: DayAssignmentType;
  readonly shortCode: string; // MAT, VES, NOC, ACU, D-PG, DESC, INC
  readonly displayLabel: string;
  readonly timeWindowLabel: string;
  readonly hasAlert: boolean;
  readonly noteDemo?: string;
}

export interface WeeklyStaffScheduleRow {
  readonly rowId: string;
  readonly employeeId: string;
  readonly employeeNameDemo: string;
  readonly employeeNumberDemo: string;
  readonly nominalCategory: NominalCategory;
  readonly operationalFunction: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly scheduleScheme: ScheduleSchemeType;
  readonly primaryShift: ShiftType | 'Jornada Acumulada';
  readonly days: readonly DailyScheduleCell[];
}

export interface CoverageAlertItem {
  readonly alertId: string;
  readonly dayLabel: string;
  readonly serviceName: string;
  readonly shiftLabel: string;
  readonly scheme: ScheduleSchemeType;
  readonly severity: OperationalStatus;
  readonly requiredCount: number;
  readonly scheduledCount: number;
  readonly description: string;
}

export interface ScheduleSchemeSummary {
  readonly scheme: ScheduleSchemeType;
  readonly description: string;
  readonly staffCount: number;
  readonly shiftBadgeCode: string;
}

export interface SchedulingQueryCriteria {
  readonly hospitalId?: string | 'ALL';
  readonly serviceId?: string | 'ALL';
  readonly shiftFilter?: 'ALL' | ShiftType | 'Jornada Acumulada';
  readonly schemeFilter?: 'ALL' | ScheduleSchemeType;
  readonly searchQuery?: string;
  readonly simulatedState?: ViewStateStatus;
}

export interface WeeklyScheduleSnapshot {
  readonly metadata: DemoDataMetadata;
  readonly weekRangeLabel: string;
  readonly weekDaysHeader: ReadonlyArray<{
    readonly dayIso: string;
    readonly dayShortLabel: string;
    readonly dayNumberLabel: string;
    readonly isWeekend: boolean;
  }>;
  readonly schemeSummaries: readonly ScheduleSchemeSummary[];
  readonly rows: readonly WeeklyStaffScheduleRow[];
  readonly coverageAlerts: readonly CoverageAlertItem[];
  readonly availableHospitals: ReadonlyArray<{ id: string; name: string }>;
  readonly availableServices: ReadonlyArray<{ id: string; name: string; hospitalId: string }>;
}

export interface SchedulingQueryResult {
  readonly state: ViewStateStatus;
  readonly snapshot: WeeklyScheduleSnapshot | null;
  readonly error: DashboardApiError | null;
}
