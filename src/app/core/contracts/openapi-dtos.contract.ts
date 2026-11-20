import {
  AdministrativeValidationState,
  AttendanceOperationalState,
  AttendanceRosterItem,
  AttendanceRosterSnapshot,
  NonCapturableReason,
} from '../models/attendance-roster.model';
import {
  CoordinationDashboardSemanticBase,
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
  ContractAssignmentRecord,
  EmployeeDetailView,
  PersonnelDirectorySnapshot,
  PersonnelPaginationMeta,
  StaffMemberRecord,
} from '../models/personnel.model';
import {
  CoverageAlertItem,
  ScheduleEstado,
  ScheduleSchemeSummary,
  ScopedScheduleRecord,
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

// ============================================================================
// Esquemas IAM V2 Verificados (`contracts/sigeh-v1.json` — F4-B)
// ============================================================================

export interface ReadHttpErrorDto {
  readonly statusCode: number;
  readonly message: string | readonly string[];
  readonly error: string;
}

/**
 * Formato especial HTTP 429 de IAM (`IamRateLimitErrorDto` en `sigeh-v1.json`):
 * contiene únicamente `statusCode: 429` y `message: string` (sin campo `error`).
 */
export interface IamRateLimitErrorDto {
  readonly statusCode: 429;
  readonly message: string;
}

export interface LoginDto {
  readonly identificador: string;
  readonly password: string;
}

export interface RefreshDto {
  readonly refreshToken: string;
}

export interface TokensDto {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly sessionId: string;
}

export type AssignmentKind = 'TITULAR' | 'ENCARGADO' | null;

export interface ProfileAssignmentScopeDto {
  readonly hospitalId?: string;
  readonly divisionId?: string | null;
  readonly servicioId?: string | null;
}

export interface ProfileAssignmentDto {
  readonly kind?: AssignmentKind;
  readonly scope?: ProfileAssignmentScopeDto;
  readonly permissions?: readonly string[];
}

export interface ProfileDto {
  readonly usuarioId: string;
  readonly sessionId: string;
  readonly provider: 'local';
  readonly assignments: readonly ProfileAssignmentDto[];
}

export interface SessionDto {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly idleExpiresAt: string;
  readonly revokedAt: string | null;
  readonly current: boolean;
}

// ============================================================================
// Esquemas L3B-2A Verificados: Personal y Adscripciones (`contracts/sigeh-v1.json` — F4-C)
// Sin RUD ni columnas excluidas del contrato.
// ============================================================================

export interface EmployeeReadDto {
  readonly empleadoId: string;
  readonly nombres: string;
  readonly primerApellido: string;
  readonly activo: boolean;
}

export interface EmployeePageDto {
  readonly items: readonly EmployeeReadDto[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export type AssignmentClaseDto = 'NOMINAL' | 'OPERATIVA';

export interface AssignmentReadDto {
  readonly adscripcionId: string;
  readonly contratoId: string;
  readonly servicioId: string;
  readonly clase: AssignmentClaseDto;
  readonly inicio: string;
  readonly fin: string | null;
}

export interface AssignmentPageDto {
  readonly items: readonly AssignmentReadDto[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export interface EmployeeDetailDto {
  readonly empleado: EmployeeReadDto;
  readonly adscripciones: AssignmentPageDto;
}

export interface ScopedStaffQueryParams {
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly fecha: string;
  readonly divisionId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Transformación explícita de `EmployeeReadDto` (`GET /api/v1/empleados`)
 * hacia `StaffMemberRecord`. Respeta la proyección limitada sin RUD ni
 * atributos fuera del contrato OpenAPI v1.
 */
export function mapEmployeeReadDtoToStaffRecord(
  dto: EmployeeReadDto,
  scope: {
    readonly hospitalId: string;
    readonly servicioId: string;
    readonly divisionId?: string | null;
    readonly fecha: string;
  },
): StaffMemberRecord {
  const fullName = `${dto.nombres} ${dto.primerApellido}`.trim();
  return {
    employeeId: dto.empleadoId,
    employeeNumberDemo: 'No incluido en contrato v1 (sin RUD)',
    fullNameDemo: fullName,
    nominalCategory: UNAVAILABLE_V1_FIELD_LABEL,
    operationalFunction: UNAVAILABLE_V1_FIELD_LABEL,
    employmentStatus: dto.activo ? 'Activo en Servicio' : 'Inactivo en Padrón',
    statusSeverity: dto.activo ? 'optimal' : 'warning',
    affiliation: {
      hospitalId: scope.hospitalId,
      hospitalName: `Hospital UUID: ${scope.hospitalId}`,
      divisionName: scope.divisionId
        ? `División UUID: ${scope.divisionId}`
        : UNAVAILABLE_V1_FIELD_LABEL,
      serviceId: scope.servicioId,
      serviceName: `Servicio UUID: ${scope.servicioId}`,
      positionCodeDemo: UNAVAILABLE_V1_FIELD_LABEL,
      contractModalityDemo: UNAVAILABLE_V1_FIELD_LABEL,
      baseShift: UNAVAILABLE_V1_FIELD_LABEL,
      scheduleScheme: UNAVAILABLE_V1_FIELD_LABEL,
      seniorityYearsDemo: null,
    },
    professionalLicenseDemo: UNAVAILABLE_V1_FIELD_LABEL,
    specialtyTag: 'Padrón vigente OpenAPI v1 (sin RUD ni expediente completo)',
    lastRosterCheckDemo: `Vigencia consultada: ${scope.fecha}`,
    supervisorObservations:
      'Detalle mínimo conforme a contrato OpenAPI v1 (empleadoId, nombres, primerApellido y activo). RUD y columnas excluidas no se exponen.',
    nombresContract: dto.nombres,
    primerApellidoContract: dto.primerApellido,
    activoContractFlag: dto.activo,
    isLimitedProjection: true,
  };
}

/**
 * Transformación explícita de `AssignmentReadDto` hacia `ContractAssignmentRecord`.
 */
export function mapAssignmentReadDtoToDomain(dto: AssignmentReadDto): ContractAssignmentRecord {
  return {
    adscripcionId: dto.adscripcionId,
    contratoId: dto.contratoId,
    servicioId: dto.servicioId,
    clase: dto.clase,
    inicio: dto.inicio,
    fin: dto.fin,
  };
}

/**
 * Transformación explícita de `EmployeePageDto` (`GET /api/v1/empleados`)
 * hacia `PersonnelDirectorySnapshot`.
 */
export function mapEmployeePageDtoToSnapshot(
  page: EmployeePageDto,
  scope: {
    readonly hospitalId: string;
    readonly servicioId: string;
    readonly divisionId?: string | null;
    readonly fecha: string;
    readonly availableHospitals: ReadonlyArray<{ id: string; name: string }>;
    readonly availableServices: ReadonlyArray<{ id: string; name: string; hospitalId: string }>;
  },
): PersonnelDirectorySnapshot {
  const items = page.items.map((emp) => mapEmployeeReadDtoToStaffRecord(emp, scope));
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: 'SIGEH-OPENAPI-V1-SCOPED-STAFF',
      disclaimer:
        'Padrón vigente recibido desde GET /api/v1/empleados dentro del ámbito hospital/servicio autorizado (sin RUD ni expediente completo).',
      simulatedHospitalUnit: `Hospital UUID: ${scope.hospitalId}`,
      simulatedRole: 'Sesión IAM V2 Autorizada (Ámbito verificado por NestJS)',
      generatedAtIso: new Date().toISOString(),
    },
    projectionMode: 'OPENAPI_V1_SCOPED_STAFF',
    cursorPagination: {
      nextCursor: page.nextCursor,
      limit: page.limit,
      order: page.order,
    },
    effectiveQueryDate: scope.fecha,
    indicators: [],
    items,
    pagination: {
      currentPage: 1,
      pageSize: page.limit,
      totalItems: items.length,
      totalPages: page.nextCursor ? 2 : 1,
      startItemIndex: items.length > 0 ? 1 : 0,
      endItemIndex: items.length,
    },
    selectedEmployee: null,
    availableHospitals: scope.availableHospitals,
    availableServices: scope.availableServices,
  };
}

/**
 * Transformación explícita de `EmployeeDetailDto` (`GET /api/v1/empleados/{empleadoId}`)
 * hacia `EmployeeDetailView`.
 */
export function mapEmployeeDetailDtoToDomain(
  dto: EmployeeDetailDto,
  scope: {
    readonly hospitalId: string;
    readonly servicioId: string;
    readonly divisionId?: string | null;
    readonly fecha: string;
  },
): EmployeeDetailView {
  const employee = mapEmployeeReadDtoToStaffRecord(dto.empleado, scope);
  const assignments = dto.adscripciones.items.map(mapAssignmentReadDtoToDomain);
  const distinctContractIds = Array.from(new Set(assignments.map((a) => a.contratoId)));

  return {
    employee,
    assignments,
    assignmentsPagination: {
      nextCursor: dto.adscripciones.nextCursor,
      limit: dto.adscripciones.limit,
      order: dto.adscripciones.order,
    },
    distinctContractIds,
    isLimitedProjection: true,
  };
}

// ============================================================================
// Esquemas L3B-2A Verificados: Programación y Tablero de Coordinación (F4-D)
// ============================================================================

export const MAX_PROGRAMMING_WINDOW_HOURS = 168;
const MAX_PROGRAMMING_WINDOW_MS = MAX_PROGRAMMING_WINDOW_HOURS * 60 * 60 * 1000;
const ISO_DATETIME_WITH_OFFSET_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export interface ScheduleReadDto {
  readonly programacionId: string;
  readonly empleadoId: string;
  readonly servicioId: string;
  readonly horarioId: string | null;
  readonly turnoCodigo: string | null;
  readonly inicioProgramado: string;
  readonly finProgramado: string;
  readonly estado: ScheduleEstado;
}

export interface SchedulePageDto {
  readonly items: readonly ScheduleReadDto[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export interface ScopedProgrammingQueryParams {
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly divisionId?: string;
  readonly desde: string;
  readonly hasta: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ProgrammingDashboardDto {
  readonly base: CoordinationDashboardSemanticBase;
  readonly jornadas: number;
  readonly empleadosProgramados: number;
  readonly programadas: number;
  readonly canceladas: number;
  readonly sustituidas: number;
  readonly cerradas: number;
  readonly horasPersonaProgramadas: number;
}

export interface ScopedCoordinationDashboardQueryParams {
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly divisionId?: string;
  readonly desde: string;
  readonly hasta: string;
}

export interface IsoWindowValidationResult {
  readonly valid: boolean;
  readonly durationHours: number | null;
  readonly errorMessage: string | null;
}

export function isValidIsoDateTimeWithOffset(value: string | undefined | null): value is string {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  if (!ISO_DATETIME_WITH_OFFSET_REGEX.test(trimmed)) {
    return false;
  }
  return !Number.isNaN(Date.parse(trimmed));
}

/**
 * Valida la ventana `desde` (inclusivo) y `hasta` (exclusivo) conforme al contrato
 * OpenAPI v1: formato ISO-8601 con zona/offset obligatorio, `hasta > desde` y
 * duración máxima exacta de 168 horas.
 */
export function validateProgrammingWindow168h(
  desde: string | undefined | null,
  hasta: string | undefined | null,
): IsoWindowValidationResult {
  if (!isValidIsoDateTimeWithOffset(desde)) {
    return {
      valid: false,
      durationHours: null,
      errorMessage:
        'El parámetro desde es obligatorio y debe ser ISO-8601 con zona/offset (ej. 2026-11-16T00:00:00-06:00 o Z).',
    };
  }
  if (!isValidIsoDateTimeWithOffset(hasta)) {
    return {
      valid: false,
      durationHours: null,
      errorMessage:
        'El parámetro hasta es obligatorio y debe ser ISO-8601 con zona/offset (ej. 2026-11-23T00:00:00-06:00 o Z).',
    };
  }

  const fromMs = Date.parse(desde.trim());
  const toMs = Date.parse(hasta.trim());
  const diffMs = toMs - fromMs;

  if (diffMs <= 0) {
    return {
      valid: false,
      durationHours: diffMs / (60 * 60 * 1000),
      errorMessage: 'El fin de ventana (hasta) debe ser estrictamente posterior al inicio (desde).',
    };
  }

  const durationHours = diffMs / (60 * 60 * 1000);
  if (diffMs > MAX_PROGRAMMING_WINDOW_MS) {
    return {
      valid: false,
      durationHours,
      errorMessage: `La ventana solicitada (${durationHours.toFixed(1)} h) excede el máximo contractual de ${MAX_PROGRAMMING_WINDOW_HOURS} horas.`,
    };
  }

  return {
    valid: true,
    durationHours,
    errorMessage: null,
  };
}

/**
 * Construye una ventana ISO-8601 válida entre 1 y 168 horas usando el offset
 * de zona horaria local (`±HH:MM`).
 */
export function buildLocalHoursWindow(
  hours: number,
  referenceDate = new Date(),
): {
  readonly desde: string;
  readonly hasta: string;
  readonly offset: string;
} {
  const clampedHours = Math.min(MAX_PROGRAMMING_WINDOW_HOURS, Math.max(1, Math.trunc(hours)));
  const tzOffsetMin = -referenceDate.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(tzOffsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  const offset = `${sign}${hh}:${mm}`;

  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + clampedHours * 60 * 60 * 1000);

  const fmt = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mon}-${day}T${hr}:${min}:${sec}${offset}`;
  };

  return {
    desde: fmt(start),
    hasta: fmt(end),
    offset,
  };
}

/**
 * Construye una ventana ISO-8601 por defecto de exactamente 168 horas (7 días)
 * usando el offset de zona horaria local (`±HH:MM`).
 */
export function buildDefaultLocal168hWindow(referenceDate = new Date()): {
  readonly desde: string;
  readonly hasta: string;
  readonly offset: string;
} {
  return buildLocalHoursWindow(MAX_PROGRAMMING_WINDOW_HOURS, referenceDate);
}

export function mapScheduleReadDtoToDomain(dto: ScheduleReadDto): ScopedScheduleRecord {
  return {
    programacionId: dto.programacionId,
    empleadoId: dto.empleadoId,
    servicioId: dto.servicioId,
    horarioId: dto.horarioId,
    turnoCodigo: dto.turnoCodigo,
    inicioProgramado: dto.inicioProgramado,
    finProgramado: dto.finProgramado,
    estado: dto.estado,
  };
}

export function mapSchedulePageDtoToSnapshot(
  page: SchedulePageDto,
  scope: {
    readonly hospitalId: string;
    readonly servicioId: string;
    readonly divisionId?: string | null;
    readonly desde: string;
    readonly hasta: string;
    readonly availableHospitals: ReadonlyArray<{ id: string; name: string }>;
    readonly availableServices: ReadonlyArray<{ id: string; name: string; hospitalId: string }>;
  },
): WeeklyScheduleSnapshot {
  const scopedItems = page.items.map(mapScheduleReadDtoToDomain);
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: 'SIGEH-OPENAPI-V1-SCOPED-PROGRAMMING',
      disclaimer:
        'Programación laboral recibida desde GET /api/v1/programaciones dentro del ámbito hospital/servicio autorizado (ventana máxima 168 h). No representa asistencia ni cobertura efectiva.',
      simulatedHospitalUnit: `Hospital UUID: ${scope.hospitalId}`,
      simulatedRole: 'Sesión IAM V2 Autorizada (Ámbito verificado por NestJS)',
      generatedAtIso: new Date().toISOString(),
    },
    projectionMode: 'OPENAPI_V1_SCOPED_PROGRAMMING',
    cursorPagination: {
      nextCursor: page.nextCursor,
      limit: page.limit,
      order: page.order,
    },
    scopedItems,
    windowDesdeIso: scope.desde,
    windowHastaIso: scope.hasta,
    weekRangeLabel: `${scope.desde} → ${scope.hasta}`,
    weekDaysHeader: [],
    schemeSummaries: [],
    rows: [],
    coverageAlerts: [],
    availableHospitals: scope.availableHospitals,
    availableServices: scope.availableServices,
  };
}

/**
 * Transformación explícita de `ProgrammingDashboardDto` (`GET /api/v1/tableros/coordinacion`)
 * hacia `ExecutiveDashboardSnapshot`.
 *
 * Regla semántica estricta:
 * - Preserva `base: 'PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA'`.
 * - Jamás rellena `serviceCoverage`, `attendance` ni `incidents` con datos sintéticos ni
 *   presenta métricas de programación como asistencia o cobertura realizada.
 */
export function mapProgrammingDashboardDtoToSnapshot(
  dto: ProgrammingDashboardDto,
  scope: {
    readonly hospitalId: string;
    readonly servicioId: string;
    readonly divisionId?: string | null;
    readonly desde: string;
    readonly hasta: string;
  },
): ExecutiveDashboardSnapshot {
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: 'SIGEH-OPENAPI-V1-COORDINATION-DASHBOARD',
      disclaimer:
        'Indicadores reales recibidos desde GET /api/v1/tableros/coordinacion (base: PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA). No representan asistencia efectiva, cobertura realizada ni incidencias verificadas.',
      simulatedHospitalUnit: `Hospital UUID: ${scope.hospitalId}`,
      simulatedRole: 'Sesión IAM V2 Autorizada (Ámbito verificado por NestJS)',
      generatedAtIso: new Date().toISOString(),
    },
    projectionMode: 'OPENAPI_V1_PROGRAMMING_INDICATORS',
    programmingIndicators: {
      base: dto.base,
      jornadas: dto.jornadas,
      empleadosProgramados: dto.empleadosProgramados,
      programadas: dto.programadas,
      canceladas: dto.canceladas,
      sustituidas: dto.sustituidas,
      cerradas: dto.cerradas,
      horasPersonaProgramadas: dto.horasPersonaProgramadas,
      hospitalId: scope.hospitalId,
      servicioId: scope.servicioId,
      divisionId: scope.divisionId ?? null,
      desde: scope.desde,
      hasta: scope.hasta,
    },
    activeShift: 'ALL',
    kpis: [],
    serviceCoverage: [],
    attendance: {
      totalScheduled: 0,
      totalPresent: 0,
      punctualityPercentage: 0,
      justifiedAbsences: 0,
      unjustifiedAbsences: 0,
      activeSubstitutions: 0,
      delayedCheckIns: 0,
      categories: [],
    },
    incidents: [],
  };
}

// ============================================================================
// Esquemas CU-ASI-01/02 Verificados: Consulta de Pases de Lista (F4-F)
// GET /api/v1/pases-lista (`listScopedAttendanceRoster`)
// Solo lectura en Coordinación; `eventoId` y `revision` se preservan como string BIGINT.
// ============================================================================

export interface AttendanceEmployeeDto {
  readonly empleadoId: string;
  readonly nombres: string;
  readonly primerApellido: string;
}

export interface LastCaptureDto {
  readonly eventoId: string;
  readonly actorId: string;
  readonly registradoEn: string;
}

export interface PaseListaItemDto {
  readonly programacionId: string;
  readonly empleado: AttendanceEmployeeDto;
  readonly horarioId: string | null;
  readonly turnoCodigo: string | null;
  readonly inicioProgramado: string;
  readonly finProgramado: string;
  readonly estadoProgramacion: ScheduleEstado;
  readonly capturada: boolean;
  readonly asistenciaId: string | null;
  readonly estadoOperativo: AttendanceOperationalState;
  readonly validacionAdministrativa: AdministrativeValidationState | null;
  readonly revision: string;
  readonly ultimaCaptura: LastCaptureDto | null;
  readonly capturable: boolean;
  readonly motivoNoCapturable: NonCapturableReason | null;
}

export interface PaseListaPageDto {
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly fecha: string;
  readonly zonaHoraria: string;
  readonly items: readonly PaseListaItemDto[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: 'id:asc';
}

export interface ScopedAttendanceRosterQueryParams {
  readonly hospitalId: string;
  readonly servicioId: string;
  readonly fecha: string;
  readonly horarioId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export function mapPaseListaItemDtoToDomain(dto: PaseListaItemDto): AttendanceRosterItem {
  return {
    programacionId: dto.programacionId,
    empleado: {
      empleadoId: dto.empleado.empleadoId,
      nombres: dto.empleado.nombres,
      primerApellido: dto.empleado.primerApellido,
      fullName: `${dto.empleado.nombres} ${dto.empleado.primerApellido}`.trim(),
    },
    horarioId: dto.horarioId,
    turnoCodigo: dto.turnoCodigo,
    inicioProgramado: dto.inicioProgramado,
    finProgramado: dto.finProgramado,
    estadoProgramacion: dto.estadoProgramacion,
    capturada: dto.capturada,
    asistenciaId: dto.asistenciaId,
    estadoOperativo: dto.estadoOperativo,
    validacionAdministrativa: dto.validacionAdministrativa,
    revision: String(dto.revision),
    ultimaCaptura: dto.ultimaCaptura
      ? {
          eventoId: String(dto.ultimaCaptura.eventoId),
          actorId: dto.ultimaCaptura.actorId,
          registradoEn: dto.ultimaCaptura.registradoEn,
        }
      : null,
    capturable: dto.capturable,
    motivoNoCapturable: dto.motivoNoCapturable,
  };
}

export function mapPaseListaPageDtoToSnapshot(dto: PaseListaPageDto): AttendanceRosterSnapshot {
  return {
    metadata: {
      isSyntheticDemo: false,
      datasetCode: 'SIGEH-OPENAPI-V1-PASES-LISTA',
      disclaimer:
        'Consulta real de GET /api/v1/pases-lista (asistencia operativa registrada por fecha local). Diferenciada de programación, cobertura efectiva e incidencias administrativas.',
      simulatedHospitalUnit: `Hospital UUID: ${dto.hospitalId}`,
      simulatedRole: 'Sesión IAM V2 Autorizada (Lectura validada por NestJS)',
      generatedAtIso: new Date().toISOString(),
    },
    hospitalId: dto.hospitalId,
    servicioId: dto.servicioId,
    fecha: dto.fecha,
    zonaHoraria: dto.zonaHoraria,
    items: dto.items.map(mapPaseListaItemDtoToDomain),
    cursorPagination: {
      nextCursor: dto.nextCursor,
      limit: dto.limit,
      order: dto.order,
    },
  };
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
