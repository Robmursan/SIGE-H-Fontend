import {
  DashboardApiError,
  DemoDataMetadata,
  ViewStateStatus,
} from './executive-dashboard.model';
import { ScheduleEstado } from './scheduling.model';

// ============================================================================
// SIGE-H — Modelos de Dominio: Consulta de Pases de Lista (F4-F · CU-ASI-01/02)
// Solo lectura para Coordinación. Diferencia estrictamente asistencia capturada
// de programación, cobertura efectiva e incidencia administrativa.
// ============================================================================

export type AttendanceOperationalState =
  | 'PENDIENTE'
  | 'PRESENTE'
  | 'AUSENTE'
  | 'PARCIAL'
  | 'NO_EXIGIBLE';

export type AdministrativeValidationState = 'PENDIENTE' | 'VALIDADA' | 'OBSERVADA';

export type NonCapturableReason =
  | 'YA_REGISTRADA'
  | 'FUERA_VENTANA'
  | 'PROGRAMACION_NO_CAPTURABLE'
  | 'CONTRATO_NO_VIGENTE'
  | 'CIERRE_EXISTENTE'
  | 'SIN_FACULTAD_CAPTURA';

export interface AttendanceRosterEmployee {
  readonly empleadoId: string;
  readonly nombres: string;
  readonly primerApellido: string;
  readonly fullName: string;
}

export interface AttendanceLastCaptureTrace {
  /** BIGINT decimal exacto del servidor; nunca convertir a Number */
  readonly eventoId: string;
  readonly actorId: string;
  readonly registradoEn: string;
}

export interface AttendanceRosterItem {
  readonly programacionId: string;
  readonly empleado: AttendanceRosterEmployee;
  readonly horarioId: string | null;
  readonly turnoCodigo: string | null;
  readonly inicioProgramado: string;
  readonly finProgramado: string;
  readonly estadoProgramacion: ScheduleEstado;
  readonly capturada: boolean;
  readonly asistenciaId: string | null;
  readonly estadoOperativo: AttendanceOperationalState;
  readonly validacionAdministrativa: AdministrativeValidationState | null;
  /** Revisión decimal BIGINT; mantener como string */
  readonly revision: string;
  readonly ultimaCaptura: AttendanceLastCaptureTrace | null;
  readonly capturable: boolean;
  readonly motivoNoCapturable: NonCapturableReason | null;
}

export interface AttendanceRosterCursorMeta {
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export interface AttendanceRosterSnapshot {
  readonly metadata: DemoDataMetadata;
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly fecha: string;
  readonly zonaHoraria: string;
  readonly items: readonly AttendanceRosterItem[];
  readonly cursorPagination: AttendanceRosterCursorMeta;
}

export interface AttendanceRosterQueryCriteria {
  readonly hospitalId?: string;
  readonly servicioId?: string;
  readonly fecha?: string;
  readonly horarioId?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly estadoFilter?: 'ALL' | AttendanceOperationalState;
  readonly simulatedState?: ViewStateStatus;
}

export interface AttendanceRosterQueryResult {
  readonly state: ViewStateStatus;
  readonly snapshot: AttendanceRosterSnapshot | null;
  readonly error: DashboardApiError | null;
}
