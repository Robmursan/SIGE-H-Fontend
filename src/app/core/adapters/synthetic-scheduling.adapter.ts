import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DemoDataMetadata } from '../models/executive-dashboard.model';
import {
  CoverageAlertItem,
  DailyScheduleCell,
  DayAssignmentType,
  ScheduleSchemeSummary,
  SchedulingQueryCriteria,
  SchedulingQueryResult,
  WeeklyStaffScheduleRow,
} from '../models/scheduling.model';
import { SchedulingGateway } from '../ports/scheduling.gateway';
import { SYNTHETIC_HOSPITALS, SYNTHETIC_SERVICES } from './synthetic-organization.adapter';

const SCHEDULING_DEMO_METADATA: DemoDataMetadata = {
  isSyntheticDemo: true,
  datasetCode: 'SIGEH-DEMO-F2-SCHED-2026',
  disclaimer:
    'Programación laboral semanal 100% sintética (F2). Visualiza horarios diurnos, acumulados y guardias nocturnas con sus descansos sin inventar reglas de cálculo.',
  simulatedHospitalUnit: 'Planeación y Rol de Turnos de Enfermería SIGE-H (Demo F2)',
  simulatedRole: 'Supervisión y Jefatura de Servicio (Visualización Inicial)',
  generatedAtIso: '2026-11-15T16:10:00.000Z',
};

const WEEK_DAYS_HEADER = [
  { dayIso: '2026-11-16', dayShortLabel: 'Lun', dayNumberLabel: '16 Nov', isWeekend: false },
  { dayIso: '2026-11-17', dayShortLabel: 'Mar', dayNumberLabel: '17 Nov', isWeekend: false },
  { dayIso: '2026-11-18', dayShortLabel: 'Mié', dayNumberLabel: '18 Nov', isWeekend: false },
  { dayIso: '2026-11-19', dayShortLabel: 'Jue', dayNumberLabel: '19 Nov', isWeekend: false },
  { dayIso: '2026-11-20', dayShortLabel: 'Vie', dayNumberLabel: '20 Nov', isWeekend: false },
  { dayIso: '2026-11-21', dayShortLabel: 'Sáb', dayNumberLabel: '21 Nov', isWeekend: true },
  { dayIso: '2026-11-22', dayShortLabel: 'Dom', dayNumberLabel: '22 Nov', isWeekend: true },
] as const;

function makeCell(
  dayIndex: number,
  assignmentType: DayAssignmentType,
  noteDemo?: string,
): DailyScheduleCell {
  const day = WEEK_DAYS_HEADER[dayIndex];
  switch (assignmentType) {
    case 'DIURNO_MATUTINO':
      return {
        ...day,
        assignmentType,
        shortCode: 'MAT',
        displayLabel: 'Matutino Diurno',
        timeWindowLabel: '07:00 - 15:00',
        hasAlert: false,
        noteDemo,
      };
    case 'DIURNO_VESPERTINO':
      return {
        ...day,
        assignmentType,
        shortCode: 'VES',
        displayLabel: 'Vespertino Diurno',
        timeWindowLabel: '14:00 - 21:30',
        hasAlert: false,
        noteDemo,
      };
    case 'GUARDIA_NOCTURNA':
      return {
        ...day,
        assignmentType,
        shortCode: 'NOC',
        displayLabel: 'Guardia Nocturna',
        timeWindowLabel: '20:30 - 07:30 (+1d)',
        hasAlert: false,
        noteDemo,
      };
    case 'JORNADA_ACUMULADA':
      return {
        ...day,
        assignmentType,
        shortCode: 'ACU',
        displayLabel: 'Jornada Acumulada',
        timeWindowLabel: '07:00 - 19:00',
        hasAlert: false,
        noteDemo,
      };
    case 'DESCANSO_POST_GUARDIA':
      return {
        ...day,
        assignmentType,
        shortCode: 'D-PG',
        displayLabel: 'Descanso Post-Guardia',
        timeWindowLabel: 'Salida de velada',
        hasAlert: false,
        noteDemo,
      };
    case 'DESCANSO_PROGRAMADO':
      return {
        ...day,
        assignmentType,
        shortCode: 'DESC',
        displayLabel: 'Descanso Programado',
        timeWindowLabel: 'Día libre según rol',
        hasAlert: false,
        noteDemo,
      };
    case 'INCIDENCIA_AUSENCIA':
      return {
        ...day,
        assignmentType,
        shortCode: 'INC',
        displayLabel: 'Incidencia / Ausencia',
        timeWindowLabel: 'Requiere cobertura',
        hasAlert: true,
        noteDemo: noteDemo ?? 'Incidencia registrada en visualización inicial',
      };
  }
}

const SYNTHETIC_WEEKLY_ROWS: readonly WeeklyStaffScheduleRow[] = [
  {
    rowId: 'ROW-DEMO-01',
    employeeId: 'EMP-DEMO-001',
    employeeNameDemo: 'Gabriela Ríos Alcántara (Demo)',
    employeeNumberDemo: 'MAT-SINT-90101',
    nominalCategory: 'Jefa(e) de Piso de Enfermería',
    operationalFunction: 'Supervisión Operativa de Piso',
    hospitalId: 'HOSP-DEMO-01',
    hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
    serviceId: 'SRV-DEMO-01',
    serviceName: 'Unidad de Cuidados Intensivos Adultos (Demo)',
    scheduleScheme: 'Horario Diurno',
    primaryShift: 'Matutino',
    days: [
      makeCell(0, 'DIURNO_MATUTINO'),
      makeCell(1, 'DIURNO_MATUTINO'),
      makeCell(2, 'DIURNO_MATUTINO'),
      makeCell(3, 'DIURNO_MATUTINO'),
      makeCell(4, 'DIURNO_MATUTINO'),
      makeCell(5, 'DESCANSO_PROGRAMADO'),
      makeCell(6, 'DESCANSO_PROGRAMADO'),
    ],
  },
  {
    rowId: 'ROW-DEMO-02',
    employeeId: 'EMP-DEMO-003',
    employeeNameDemo: 'Diana Ponce Lara (Demo)',
    employeeNumberDemo: 'MAT-SINT-90103',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Cuidado Crítico e Intensivo',
    hospitalId: 'HOSP-DEMO-01',
    hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
    serviceId: 'SRV-DEMO-01',
    serviceName: 'Unidad de Cuidados Intensivos Adultos (Demo)',
    scheduleScheme: 'Guardia Nocturna',
    primaryShift: 'Nocturno',
    days: [
      makeCell(0, 'GUARDIA_NOCTURNA', 'Velada A'),
      makeCell(1, 'DESCANSO_POST_GUARDIA'),
      makeCell(2, 'GUARDIA_NOCTURNA', 'Velada A'),
      makeCell(3, 'DESCANSO_POST_GUARDIA'),
      makeCell(4, 'GUARDIA_NOCTURNA', 'Velada A'),
      makeCell(5, 'DESCANSO_POST_GUARDIA'),
      makeCell(6, 'DESCANSO_PROGRAMADO'),
    ],
  },
  {
    rowId: 'ROW-DEMO-03',
    employeeId: 'EMP-DEMO-005',
    employeeNameDemo: 'Verónica Juárez Téllez (Demo)',
    employeeNumberDemo: 'MAT-SINT-90105',
    nominalCategory: 'Enfermera(o) General Titulada(o) B',
    operationalFunction: 'Triage y Atención de Urgencias',
    hospitalId: 'HOSP-DEMO-01',
    hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
    serviceId: 'SRV-DEMO-02',
    serviceName: 'Urgencias y Triage Respiratorio (Demo)',
    scheduleScheme: 'Horario Diurno',
    primaryShift: 'Vespertino',
    days: [
      makeCell(0, 'DIURNO_VESPERTINO'),
      makeCell(1, 'DIURNO_VESPERTINO'),
      makeCell(2, 'INCIDENCIA_AUSENCIA', 'Incapacidad temporal sintética (Suplencia activada)'),
      makeCell(3, 'INCIDENCIA_AUSENCIA', 'Incapacidad temporal sintética (Suplencia activada)'),
      makeCell(4, 'INCIDENCIA_AUSENCIA', 'Incapacidad temporal sintética (Suplencia activada)'),
      makeCell(5, 'DESCANSO_PROGRAMADO'),
      makeCell(6, 'DESCANSO_PROGRAMADO'),
    ],
  },
  {
    rowId: 'ROW-DEMO-04',
    employeeId: 'EMP-DEMO-006',
    employeeNameDemo: 'Rosa María Delgado (Demo)',
    employeeNumberDemo: 'MAT-SINT-90106',
    nominalCategory: 'Auxiliar de Enfermería General A',
    operationalFunction: 'Atención Clínica de Hospitalización',
    hospitalId: 'HOSP-DEMO-01',
    hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
    serviceId: 'SRV-DEMO-03',
    serviceName: 'Hospitalización Medicina Interna (Demo)',
    scheduleScheme: 'Jornada Acumulada',
    primaryShift: 'Jornada Acumulada',
    days: [
      makeCell(0, 'DESCANSO_PROGRAMADO'),
      makeCell(1, 'DESCANSO_PROGRAMADO'),
      makeCell(2, 'DESCANSO_PROGRAMADO'),
      makeCell(3, 'DESCANSO_PROGRAMADO'),
      makeCell(4, 'DESCANSO_PROGRAMADO'),
      makeCell(5, 'JORNADA_ACUMULADA', 'Guardia fin de semana'),
      makeCell(6, 'JORNADA_ACUMULADA', 'Guardia fin de semana'),
    ],
  },
  {
    rowId: 'ROW-DEMO-05',
    employeeId: 'EMP-DEMO-007',
    employeeNameDemo: 'Fernando Castillo Nava (Demo)',
    employeeNumberDemo: 'MAT-SINT-90107',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Cuidado Crítico e Intensivo',
    hospitalId: 'HOSP-DEMO-01',
    hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
    serviceId: 'SRV-DEMO-04',
    serviceName: 'Terapia Intermedia y Cardiología (Demo)',
    scheduleScheme: 'Guardia Nocturna',
    primaryShift: 'Nocturno',
    days: [
      makeCell(0, 'DESCANSO_POST_GUARDIA'),
      makeCell(1, 'GUARDIA_NOCTURNA', 'Velada B'),
      makeCell(2, 'DESCANSO_POST_GUARDIA'),
      makeCell(3, 'GUARDIA_NOCTURNA', 'Velada B'),
      makeCell(4, 'DESCANSO_POST_GUARDIA'),
      makeCell(5, 'GUARDIA_NOCTURNA', 'Velada B'),
      makeCell(6, 'DESCANSO_POST_GUARDIA'),
    ],
  },
  {
    rowId: 'ROW-DEMO-06',
    employeeId: 'EMP-DEMO-009',
    employeeNameDemo: 'Raúl Mendoza Solís (Demo)',
    employeeNumberDemo: 'MAT-SINT-90109',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Enfermería Quirúrgica e Instrumentación',
    hospitalId: 'HOSP-DEMO-01',
    hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
    serviceId: 'SRV-DEMO-05',
    serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
    scheduleScheme: 'Horario Diurno',
    primaryShift: 'Vespertino',
    days: [
      makeCell(0, 'DIURNO_VESPERTINO'),
      makeCell(1, 'INCIDENCIA_AUSENCIA', 'Comisión académica — descubierto en sala 4'),
      makeCell(2, 'INCIDENCIA_AUSENCIA', 'Comisión académica — descubierto en sala 4'),
      makeCell(3, 'DIURNO_VESPERTINO'),
      makeCell(4, 'DIURNO_VESPERTINO'),
      makeCell(5, 'DESCANSO_PROGRAMADO'),
      makeCell(6, 'DESCANSO_PROGRAMADO'),
    ],
  },
  {
    rowId: 'ROW-DEMO-07',
    employeeId: 'EMP-DEMO-010',
    employeeNameDemo: 'Natalia Peñaloza Cruz (Demo)',
    employeeNumberDemo: 'MAT-SINT-90110',
    nominalCategory: 'Jefa(e) de Piso de Enfermería',
    operationalFunction: 'Supervisión Operativa de Piso',
    hospitalId: 'HOSP-DEMO-02',
    hospitalName: 'Hospital de Especialidades Materno-Pediátrico (Demo)',
    serviceId: 'SRV-DEMO-07',
    serviceName: 'Unidad de Cuidados Intensivos Neonatales (Demo)',
    scheduleScheme: 'Horario Diurno',
    primaryShift: 'Matutino',
    days: [
      makeCell(0, 'DIURNO_MATUTINO'),
      makeCell(1, 'DIURNO_MATUTINO'),
      makeCell(2, 'DIURNO_MATUTINO'),
      makeCell(3, 'DIURNO_MATUTINO'),
      makeCell(4, 'DIURNO_MATUTINO'),
      makeCell(5, 'DESCANSO_PROGRAMADO'),
      makeCell(6, 'DESCANSO_PROGRAMADO'),
    ],
  },
  {
    rowId: 'ROW-DEMO-08',
    employeeId: 'EMP-DEMO-012',
    employeeNameDemo: 'Arturo Villalobos Paz (Demo)',
    employeeNumberDemo: 'MAT-SINT-90112',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Enfermería Quirúrgica e Instrumentación',
    hospitalId: 'HOSP-DEMO-03',
    hospitalName: 'Centro de Alta Especialidad Quirúrgica Sur (Demo)',
    serviceId: 'SRV-DEMO-10',
    serviceName: 'Pabellón de Cirugía Cardiovascular y Trasplantes (Demo)',
    scheduleScheme: 'Jornada Acumulada',
    primaryShift: 'Jornada Acumulada',
    days: [
      makeCell(0, 'DESCANSO_PROGRAMADO'),
      makeCell(1, 'DESCANSO_PROGRAMADO'),
      makeCell(2, 'DESCANSO_PROGRAMADO'),
      makeCell(3, 'DESCANSO_PROGRAMADO'),
      makeCell(4, 'DESCANSO_PROGRAMADO'),
      makeCell(5, 'JORNADA_ACUMULADA', 'Cobertura quirúrgica acumulada'),
      makeCell(6, 'JORNADA_ACUMULADA', 'Cobertura quirúrgica acumulada'),
    ],
  },
];

const SYNTHETIC_COVERAGE_ALERTS: readonly CoverageAlertItem[] = [
  {
    alertId: 'ALR-SCHED-01',
    dayLabel: 'Mar 17 Nov - Mié 18 Nov',
    serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
    shiftLabel: 'Vespertino (14:00 - 21:30)',
    scheme: 'Horario Diurno',
    severity: 'critical',
    requiredCount: 20,
    scheduledCount: 18,
    description:
      'Visualización inicial: Descubierto de 2 plazas de enfermería quirúrgica por comisión e incapacidad sintética.',
  },
  {
    alertId: 'ALR-SCHED-02',
    dayLabel: 'Mié 18 Nov - Vie 20 Nov',
    serviceName: 'Urgencias y Triage Respiratorio (Demo)',
    shiftLabel: 'Vespertino (14:00 - 21:30)',
    scheme: 'Horario Diurno',
    severity: 'warning',
    requiredCount: 30,
    scheduledCount: 29,
    description:
      'Visualización inicial: Incapacidad temporal de 3 días en Triage cubierta parcialmente con rol de suplencia.',
  },
  {
    alertId: 'ALR-SCHED-03',
    dayLabel: 'Sáb 21 Nov - Dom 22 Nov',
    serviceName: 'Hospitalización Medicina Interna (Demo)',
    shiftLabel: 'Jornada Acumulada (07:00 - 19:00)',
    scheme: 'Jornada Acumulada',
    severity: 'optimal',
    requiredCount: 18,
    scheduledCount: 18,
    description:
      'Visualización inicial: Cobertura de fin de semana completa bajo modalidad de Jornada Acumulada.',
  },
];

@Injectable({ providedIn: 'root' })
export class SyntheticSchedulingAdapter implements SchedulingGateway {
  public readonly adapterName = 'SyntheticSchedulingDemoAdapter (F2)';
  public readonly isSyntheticDemo = true;

  public queryWeeklySchedule(
    criteria: SchedulingQueryCriteria,
  ): Observable<SchedulingQueryResult> {
    const simulatedState = criteria.simulatedState ?? 'ready';

    if (simulatedState === 'loading') {
      return of({ state: 'loading', snapshot: null, error: null });
    }

    if (simulatedState === 'error') {
      return of({
        state: 'error',
        snapshot: null,
        error: {
          code: 'SYNTHETIC_SIMULATED_ERROR',
          title: 'Fallo Simulado al Cargar Programación Laboral Semanal',
          message:
            'Simulación F2: No fue posible recuperar la matriz de turnos diurnos, acumulados y guardias nocturnas.',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    if (simulatedState === 'forbidden') {
      return of({
        state: 'forbidden',
        snapshot: null,
        error: {
          code: 'FORBIDDEN_ROLE',
          title: 'Acceso Restringido a Programación Laboral',
          message:
            'Simulación F2 (HTTP 403): Este calendario semanal está reservado para Supervisión y Jefaturas de Enfermería.',
          requiredRoleHint: 'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_SERVICIO',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    const hospitalFilter = criteria.hospitalId ?? 'ALL';
    const serviceFilter = criteria.serviceId ?? 'ALL';
    const shiftFilter = criteria.shiftFilter ?? 'ALL';
    const schemeFilter = criteria.schemeFilter ?? 'ALL';
    const query = (criteria.searchQuery ?? '').trim().toLowerCase();

    const filteredRows =
      simulatedState === 'empty'
        ? []
        : SYNTHETIC_WEEKLY_ROWS.filter((row) => {
            if (hospitalFilter !== 'ALL' && row.hospitalId !== hospitalFilter) {
              return false;
            }
            if (serviceFilter !== 'ALL' && row.serviceId !== serviceFilter) {
              return false;
            }
            if (shiftFilter !== 'ALL' && row.primaryShift !== shiftFilter) {
              return false;
            }
            if (schemeFilter !== 'ALL' && row.scheduleScheme !== schemeFilter) {
              return false;
            }
            if (query.length > 0) {
              return (
                row.employeeNameDemo.toLowerCase().includes(query) ||
                row.employeeNumberDemo.toLowerCase().includes(query) ||
                row.serviceName.toLowerCase().includes(query)
              );
            }
            return true;
          });

    const availableHospitals = SYNTHETIC_HOSPITALS.map((h) => ({
      id: h.hospitalId,
      name: h.hospitalName,
    }));
    const availableServices = SYNTHETIC_SERVICES.map((s) => ({
      id: s.serviceId,
      name: s.serviceName,
      hospitalId: s.hospitalId,
    }));

    const schemeSummaries: readonly ScheduleSchemeSummary[] = [
      {
        scheme: 'Horario Diurno',
        description:
          'Turnos Matutino y Vespertino ordinarios con descansos programados según rol institucional.',
        staffCount: filteredRows.filter((r) => r.scheduleScheme === 'Horario Diurno').length,
        shiftBadgeCode: 'MAT / VES',
      },
      {
        scheme: 'Jornada Acumulada',
        description:
          'Cobertura concentrada en fines de semana y días festivos con días de descanso entre semana.',
        staffCount: filteredRows.filter((r) => r.scheduleScheme === 'Jornada Acumulada').length,
        shiftBadgeCode: 'ACU',
      },
      {
        scheme: 'Guardia Nocturna',
        description:
          'Veladas nocturnas alternadas con días de Descanso Post-Guardia (D-PG) y descanso programado.',
        staffCount: filteredRows.filter((r) => r.scheduleScheme === 'Guardia Nocturna').length,
        shiftBadgeCode: 'NOC + D-PG',
      },
    ];

    if (filteredRows.length === 0) {
      return of({
        state: 'empty',
        snapshot: {
          metadata: SCHEDULING_DEMO_METADATA,
          weekRangeLabel: 'Semana Operativa Demo: 16 al 22 de Noviembre 2026',
          weekDaysHeader: WEEK_DAYS_HEADER,
          schemeSummaries,
          rows: [],
          coverageAlerts: [],
          availableHospitals,
          availableServices,
        },
        error: null,
      });
    }

    return of({
      state: 'ready',
      snapshot: {
        metadata: SCHEDULING_DEMO_METADATA,
        weekRangeLabel: 'Semana Operativa Demo: 16 al 22 de Noviembre 2026',
        weekDaysHeader: WEEK_DAYS_HEADER,
        schemeSummaries,
        rows: filteredRows,
        coverageAlerts: SYNTHETIC_COVERAGE_ALERTS,
        availableHospitals,
        availableServices,
      },
      error: null,
    });
  }
}
