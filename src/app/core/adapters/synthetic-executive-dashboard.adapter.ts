import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  AttendanceSummary,
  DashboardQueryCriteria,
  DashboardQueryResult,
  DemoDataMetadata,
  ExecutiveDashboardSnapshot,
  KpiMetric,
  OperationalIncident,
  ServiceCoverageItem,
  ShiftFilter,
} from '../models/executive-dashboard.model';
import { ExecutiveDashboardGateway } from '../ports/executive-dashboard.gateway';

const SYNTHETIC_METADATA: DemoDataMetadata = {
  isSyntheticDemo: true,
  datasetCode: 'SIGEH-DEMO-F1-SYNTH-2026',
  disclaimer:
    'Conjunto de datos 100% sintético para validación funcional y visual de F1. No contiene registros clínicos, nominales ni hospitalarios reales.',
  simulatedHospitalUnit: 'Centro Hospitalario Modelo de Simulación (Entorno Demo F1)',
  simulatedRole: 'Jefatura de División de Enfermería (Vista Ejecutiva Demo)',
  generatedAtIso: '2026-11-15T15:00:00.000Z',
};

const SYNTHETIC_SERVICE_COVERAGE: readonly ServiceCoverageItem[] = [
  {
    serviceId: 'SRV-DEMO-01',
    serviceName: 'Unidad de Cuidados Intensivos Adultos (Demo)',
    floorOrWing: 'Torre A · Piso 3',
    shift: 'Matutino',
    requiredStaff: 24,
    assignedStaff: 24,
    presentStaff: 24,
    coveragePercentage: 100,
    status: 'optimal',
    activeIncidentsCount: 0,
    supervisorNote: 'Plantilla completa 1:1 en cubículos críticos simulados.',
  },
  {
    serviceId: 'SRV-DEMO-02',
    serviceName: 'Urgencias y Triage Respiratorio (Demo)',
    floorOrWing: 'Planta Baja · Ala Norte',
    shift: 'Matutino',
    requiredStaff: 30,
    assignedStaff: 29,
    presentStaff: 27,
    coveragePercentage: 90,
    status: 'warning',
    activeIncidentsCount: 2,
    supervisorNote: '2 suplencias internas activadas por incapacidad sintética.',
  },
  {
    serviceId: 'SRV-DEMO-03',
    serviceName: 'Hospitalización Medicina Interna (Demo)',
    floorOrWing: 'Torre B · Piso 4',
    shift: 'Matutino',
    requiredStaff: 22,
    assignedStaff: 22,
    presentStaff: 21,
    coveragePercentage: 95,
    status: 'optimal',
    activeIncidentsCount: 1,
    supervisorNote: 'Operación estable; 1 retardo menor registrado en control.',
  },
  {
    serviceId: 'SRV-DEMO-04',
    serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
    floorOrWing: 'Torre A · Piso 2',
    shift: 'Vespertino',
    requiredStaff: 20,
    assignedStaff: 19,
    presentStaff: 16,
    coveragePercentage: 80,
    status: 'critical',
    activeIncidentsCount: 3,
    supervisorNote: 'Prioridad de jefatura: requiere reasignar 2 enfermeras quirúrgicas de guardia.',
  },
  {
    serviceId: 'SRV-DEMO-05',
    serviceName: 'Pediatría y Neonatología (Demo)',
    floorOrWing: 'Torre C · Piso 1',
    shift: 'Vespertino',
    requiredStaff: 18,
    assignedStaff: 18,
    presentStaff: 18,
    coveragePercentage: 100,
    status: 'optimal',
    activeIncidentsCount: 0,
    supervisorNote: 'Cobertura neonatal verificada sin novedades.',
  },
  {
    serviceId: 'SRV-DEMO-06',
    serviceName: 'Terapia Intermedia y Cardiología (Demo)',
    floorOrWing: 'Torre A · Piso 4',
    shift: 'Nocturno',
    requiredStaff: 16,
    assignedStaff: 16,
    presentStaff: 14,
    coveragePercentage: 88,
    status: 'warning',
    activeIncidentsCount: 1,
    supervisorNote: 'En gestión de guardia flotante para cubrir permiso económico.',
  },
  {
    serviceId: 'SRV-DEMO-07',
    serviceName: 'Gineco-Obstetricia y Tococirugía (Demo)',
    floorOrWing: 'Torre C · Piso 2',
    shift: 'Nocturno',
    requiredStaff: 18,
    assignedStaff: 18,
    presentStaff: 18,
    coveragePercentage: 100,
    status: 'optimal',
    activeIncidentsCount: 0,
    supervisorNote: 'Guardia nocturna completa y validada por supervisión.',
  },
];

const SYNTHETIC_INCIDENTS: readonly OperationalIncident[] = [
  {
    incidentId: 'INC-DEMO-101',
    category: 'Descubierto de Turno',
    severity: 'high',
    serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
    shift: 'Vespertino',
    reportedTime: '13:45 hrs',
    resolutionStatus: 'Pendiente de Cobertura',
    summary:
      'Simulación: 2 plazas de enfermería quirúrgica pendientes de enlace en sala 4 y 5.',
  },
  {
    incidentId: 'INC-DEMO-102',
    category: 'Incapacidad Médica',
    severity: 'medium',
    serviceName: 'Urgencias y Triage Respiratorio (Demo)',
    shift: 'Matutino',
    reportedTime: '06:50 hrs',
    resolutionStatus: 'Suplencia Asignada',
    summary:
      'Simulación: Incapacidad temporal notificada; cubierta mediante pool de guardia matutina.',
  },
  {
    incidentId: 'INC-DEMO-103',
    category: 'Falta Injustificada',
    severity: 'high',
    serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
    shift: 'Vespertino',
    reportedTime: '14:15 hrs',
    resolutionStatus: 'En Revisión Jefatura',
    summary:
      'Simulación: Ausencia sin aviso previo al cierre de tolerancia de ingreso vespertino.',
  },
  {
    incidentId: 'INC-DEMO-104',
    category: 'Permiso Económico',
    severity: 'medium',
    serviceName: 'Terapia Intermedia y Cardiología (Demo)',
    shift: 'Nocturno',
    reportedTime: '19:30 hrs',
    resolutionStatus: 'Suplencia Asignada',
    summary:
      'Simulación: Permiso programado autorizado con rotación de personal flotante.',
  },
  {
    incidentId: 'INC-DEMO-105',
    category: 'Retardo Operativo',
    severity: 'low',
    serviceName: 'Hospitalización Medicina Interna (Demo)',
    shift: 'Matutino',
    reportedTime: '07:18 hrs',
    resolutionStatus: 'En Revisión Jefatura',
    summary:
      'Simulación: Ingreso 18 minutos posterior al pase de lista en estación de piso 4.',
  },
];

@Injectable({ providedIn: 'root' })
export class SyntheticExecutiveDashboardAdapter implements ExecutiveDashboardGateway {
  public readonly adapterName = 'SyntheticDemoExecutiveAdapter (F1)';
  public readonly isSyntheticDemo = true;

  public queryDashboard(criteria: DashboardQueryCriteria): Observable<DashboardQueryResult> {
    const simulatedState = criteria.simulatedState ?? 'ready';

    if (simulatedState === 'loading') {
      return of({
        state: 'loading',
        snapshot: null,
        error: null,
      });
    }

    if (simulatedState === 'error') {
      return of({
        state: 'error',
        snapshot: null,
        error: {
          code: 'SYNTHETIC_SIMULATED_ERROR',
          title: 'Fallo Simulado de Sincronización de Indicadores',
          message:
            'Simulación F1: No fue posible recuperar el corte operativo del turno. Verifique la conectividad o reintente la consulta.',
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
          title: 'Acceso Denegado al Tablero Ejecutivo de Jefatura',
          message:
            'Simulación F1 (HTTP 403): Este panel requiere perfil de Supervisión General o Jefatura de División de Enfermería.',
          requiredRoleHint: 'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    if (simulatedState === 'empty') {
      return of({
        state: 'empty',
        snapshot: this.buildSnapshot(criteria.shift ?? 'ALL', [], []),
        error: null,
      });
    }

    const activeShift: ShiftFilter = criteria.shift ?? 'ALL';
    const normalizedQuery = (criteria.serviceQuery ?? '').trim().toLowerCase();
    const statusFilter = criteria.statusFilter ?? 'ALL';

    const filteredServices = SYNTHETIC_SERVICE_COVERAGE.filter((item) => {
      const matchesShift = activeShift === 'ALL' || item.shift === activeShift;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.serviceName.toLowerCase().includes(normalizedQuery) ||
        item.floorOrWing.toLowerCase().includes(normalizedQuery) ||
        item.supervisorNote.toLowerCase().includes(normalizedQuery);
      return matchesShift && matchesStatus && matchesQuery;
    });

    const filteredIncidents = SYNTHETIC_INCIDENTS.filter((inc) => {
      const matchesShift = activeShift === 'ALL' || inc.shift === activeShift;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        inc.serviceName.toLowerCase().includes(normalizedQuery) ||
        inc.category.toLowerCase().includes(normalizedQuery) ||
        inc.summary.toLowerCase().includes(normalizedQuery);
      return matchesShift && matchesQuery;
    });

    if (filteredServices.length === 0 && filteredIncidents.length === 0) {
      return of({
        state: 'empty',
        snapshot: this.buildSnapshot(activeShift, [], []),
        error: null,
      });
    }

    return of({
      state: 'ready',
      snapshot: this.buildSnapshot(activeShift, filteredServices, filteredIncidents),
      error: null,
    });
  }

  private buildSnapshot(
    activeShift: ShiftFilter,
    services: readonly ServiceCoverageItem[],
    incidents: readonly OperationalIncident[],
  ): ExecutiveDashboardSnapshot {
    const totalRequired = services.reduce((acc, item) => acc + item.requiredStaff, 0);
    const totalAssigned = services.reduce((acc, item) => acc + item.assignedStaff, 0);
    const totalPresent = services.reduce((acc, item) => acc + item.presentStaff, 0);

    const globalCoveragePct =
      totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 0;
    const attendanceRatePct =
      totalAssigned > 0 ? Math.round((totalPresent / totalAssigned) * 100) : 0;
    const highSeverityCount = incidents.filter((i) => i.severity === 'high').length;

    const kpis: readonly KpiMetric[] = [
      {
        id: 'kpi-personal',
        category: 'personal',
        label: 'Personal de Enfermería en Turno',
        value: totalPresent,
        formattedValue: `${totalPresent} / ${totalRequired}`,
        unit: 'enfermeras(os)',
        targetLabel: `Plantilla requerida: ${totalRequired}`,
        compliancePercentage: globalCoveragePct,
        deltaLabel: `${totalAssigned} asignados en rol`,
        trendDirection: globalCoveragePct >= 95 ? 'up' : 'neutral',
        status:
          globalCoveragePct >= 95
            ? 'optimal'
            : globalCoveragePct >= 88
              ? 'warning'
              : 'critical',
        summary: 'Efectivos presentes validados en pase de lista sintético.',
      },
      {
        id: 'kpi-asistencia',
        category: 'asistencia',
        label: 'Índice de Asistencia y Puntualidad',
        value: attendanceRatePct,
        formattedValue: `${attendanceRatePct}%`,
        unit: 'cumplimiento',
        targetLabel: 'Meta institucional: ≥ 96%',
        compliancePercentage: attendanceRatePct,
        deltaLabel: '+1.4% vs. corte anterior (Demo)',
        trendDirection: attendanceRatePct >= 94 ? 'up' : 'down',
        status:
          attendanceRatePct >= 95
            ? 'optimal'
            : attendanceRatePct >= 88
              ? 'warning'
              : 'critical',
        summary: 'Asistencia efectiva sobre plantilla programada en rol activo.',
      },
      {
        id: 'kpi-incidencias',
        category: 'incidencias',
        label: 'Incidencias Operativas del Turno',
        value: incidents.length,
        formattedValue: `${incidents.length}`,
        unit: 'eventos activos',
        targetLabel: `Prioridad alta: ${highSeverityCount}`,
        compliancePercentage: Math.max(0, 100 - incidents.length * 12),
        deltaLabel:
          highSeverityCount > 0
            ? `${highSeverityCount} requieren acción de jefatura`
            : 'Sin descubiertos críticos',
        trendDirection: highSeverityCount > 0 ? 'down' : 'up',
        status:
          highSeverityCount > 1
            ? 'critical'
            : incidents.length > 0
              ? 'warning'
              : 'optimal',
        summary: 'Faltas, incapacidades, retardos y suplencias en seguimiento.',
      },
      {
        id: 'kpi-cobertura',
        category: 'cobertura',
        label: 'Cobertura Clínica por Servicio',
        value: globalCoveragePct,
        formattedValue: `${globalCoveragePct}%`,
        unit: 'cobertura global',
        targetLabel: `${services.length} servicios monitoreados`,
        compliancePercentage: globalCoveragePct,
        deltaLabel: `${services.filter((s) => s.status === 'optimal').length} de ${services.length} en nivel óptimo`,
        trendDirection: globalCoveragePct >= 92 ? 'up' : 'down',
        status:
          globalCoveragePct >= 95
            ? 'optimal'
            : globalCoveragePct >= 88
              ? 'warning'
              : 'critical',
        summary: 'Relación de camas/servicios cubiertos según indicador normativo demo.',
      },
    ];

    const attendance: AttendanceSummary = {
      totalScheduled: totalAssigned,
      totalPresent,
      punctualityPercentage: totalPresent > 0 ? Math.min(100, attendanceRatePct + 2) : 0,
      justifiedAbsences: Math.max(0, Math.floor((totalAssigned - totalPresent) * 0.65)),
      unjustifiedAbsences: Math.max(0, Math.ceil((totalAssigned - totalPresent) * 0.35)),
      activeSubstitutions: Math.min(totalPresent, incidents.filter((i) => i.resolutionStatus === 'Suplencia Asignada').length + 2),
      delayedCheckIns: incidents.filter((i) => i.category === 'Retardo Operativo').length + 1,
      categories: [
        {
          categoryId: 'cat-esp',
          categoryLabel: 'Enfermería Especialista (UCI / Quirúrgica / Pediátrica)',
          scheduledCount: Math.round(totalAssigned * 0.35),
          presentCount: Math.round(totalPresent * 0.34),
          availabilityPercentage:
            totalAssigned > 0
              ? Math.round((Math.round(totalPresent * 0.34) / Math.max(1, Math.round(totalAssigned * 0.35))) * 100)
              : 0,
          status: 'warning',
        },
        {
          categoryId: 'cat-gen',
          categoryLabel: 'Enfermería General Clínica',
          scheduledCount: Math.round(totalAssigned * 0.45),
          presentCount: Math.round(totalPresent * 0.46),
          availabilityPercentage: 98,
          status: 'optimal',
        },
        {
          categoryId: 'cat-aux',
          categoryLabel: 'Auxiliar de Enfermería Hospitalaria',
          scheduledCount: Math.max(0, totalAssigned - Math.round(totalAssigned * 0.8) - 6),
          presentCount: Math.max(0, totalPresent - Math.round(totalPresent * 0.8) - 6),
          availabilityPercentage: 94,
          status: 'optimal',
        },
        {
          categoryId: 'cat-jef',
          categoryLabel: 'Supervisión y Jefatura de Piso',
          scheduledCount: totalAssigned > 0 ? 6 : 0,
          presentCount: totalPresent > 0 ? 6 : 0,
          availabilityPercentage: totalPresent > 0 ? 100 : 0,
          status: 'optimal',
        },
      ],
    };

    return {
      metadata: SYNTHETIC_METADATA,
      activeShift,
      kpis,
      serviceCoverage: services,
      attendance,
      incidents,
    };
  }
}
