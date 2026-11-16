import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DemoDataMetadata, KpiMetric } from '../models/executive-dashboard.model';
import {
  PersonnelQueryCriteria,
  PersonnelQueryResult,
  StaffMemberRecord,
} from '../models/personnel.model';
import { PersonnelGateway } from '../ports/personnel.gateway';
import { SYNTHETIC_HOSPITALS, SYNTHETIC_SERVICES } from './synthetic-organization.adapter';

const PERSONNEL_DEMO_METADATA: DemoDataMetadata = {
  isSyntheticDemo: true,
  datasetCode: 'SIGEH-DEMO-F2-PERSONAL-2026',
  disclaimer:
    'Padrón de personal 100% sintético para demostración F2. Solo lectura: no contiene datos nominales ni cédulas reales.',
  simulatedHospitalUnit: 'Plantilla Institucional Simulada SIGE-H (Demo F2)',
  simulatedRole: 'Jefatura de División / Recursos Humanos de Enfermería (Solo Lectura)',
  generatedAtIso: '2026-11-15T16:05:00.000Z',
};

export const SYNTHETIC_STAFF_RECORDS: readonly StaffMemberRecord[] = [
  {
    employeeId: 'EMP-DEMO-001',
    employeeNumberDemo: 'MAT-SINT-90101',
    fullNameDemo: 'Gabriela Ríos Alcántara (Demo)',
    nominalCategory: 'Jefa(e) de Piso de Enfermería',
    operationalFunction: 'Supervisión Operativa de Piso',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001019',
    specialtyTag: 'Medicina Crítica y Terapia Intensiva',
    lastRosterCheckDemo: 'Hoy · 07:02 hrs',
    supervisorObservations:
      'Coordina enlace de guardia y distribución de cubículos críticos en UCI Adultos.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
      serviceId: 'SRV-DEMO-01',
      serviceName: 'Unidad de Cuidados Intensivos Adultos (Demo)',
      positionCodeDemo: 'PLZ-SINT-JP-301',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Matutino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 11,
    },
  },
  {
    employeeId: 'EMP-DEMO-002',
    employeeNumberDemo: 'MAT-SINT-90102',
    fullNameDemo: 'Héctor Vázquez Mora (Demo)',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Cuidado Crítico e Intensivo',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001028',
    specialtyTag: 'Cuidados Intensivos Adultos',
    lastRosterCheckDemo: 'Hoy · 06:55 hrs',
    supervisorObservations: 'Asignado a soporte ventilatorio avanzado en cubículos 1 al 3.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
      serviceId: 'SRV-DEMO-01',
      serviceName: 'Unidad de Cuidados Intensivos Adultos (Demo)',
      positionCodeDemo: 'PLZ-SINT-EEC-304',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Matutino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 8,
    },
  },
  {
    employeeId: 'EMP-DEMO-003',
    employeeNumberDemo: 'MAT-SINT-90103',
    fullNameDemo: 'Diana Ponce Lara (Demo)',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Cuidado Crítico e Intensivo',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001037',
    specialtyTag: 'Terapia Intensiva y Hemodinamia',
    lastRosterCheckDemo: 'Guardia Nocturna Activa',
    supervisorObservations:
      'Esquema de guardia nocturna con descanso post-guardia programado conforme al rol semanal.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
      serviceId: 'SRV-DEMO-01',
      serviceName: 'Unidad de Cuidados Intensivos Adultos (Demo)',
      positionCodeDemo: 'PLZ-SINT-EEC-309',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Nocturno',
      scheduleScheme: 'Guardia Nocturna',
      seniorityYearsDemo: 6,
    },
  },
  {
    employeeId: 'EMP-DEMO-004',
    employeeNumberDemo: 'MAT-SINT-90104',
    fullNameDemo: 'Marco Antonio Silva (Demo)',
    nominalCategory: 'Enfermera(o) General Titulada(o) B',
    operationalFunction: 'Triage y Atención de Urgencias',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001046',
    specialtyTag: 'Urgencias y Clasificación Triage',
    lastRosterCheckDemo: 'Hoy · 06:58 hrs',
    supervisorObservations: 'Responsable de clasificación inicial y enlace de camas de observación.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
      serviceId: 'SRV-DEMO-02',
      serviceName: 'Urgencias y Triage Respiratorio (Demo)',
      positionCodeDemo: 'PLZ-SINT-EGT-102',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Matutino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 9,
    },
  },
  {
    employeeId: 'EMP-DEMO-005',
    employeeNumberDemo: 'MAT-SINT-90105',
    fullNameDemo: 'Verónica Juárez Téllez (Demo)',
    nominalCategory: 'Enfermera(o) General Titulada(o) B',
    operationalFunction: 'Triage y Atención de Urgencias',
    employmentStatus: 'Incapacidad Temporal',
    statusSeverity: 'warning',
    professionalLicenseDemo: 'CED-DEMO-001055',
    specialtyTag: 'Atención Primaria de Urgencias',
    lastRosterCheckDemo: 'Incapacidad Vigente (3 días)',
    supervisorObservations:
      'Incapacidad médica sintética registrada; plaza cubierta temporalmente por suplencia institucional.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
      serviceId: 'SRV-DEMO-02',
      serviceName: 'Urgencias y Triage Respiratorio (Demo)',
      positionCodeDemo: 'PLZ-SINT-EGT-108',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Vespertino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 5,
    },
  },
  {
    employeeId: 'EMP-DEMO-006',
    employeeNumberDemo: 'MAT-SINT-90106',
    fullNameDemo: 'Rosa María Delgado (Demo)',
    nominalCategory: 'Auxiliar de Enfermería General A',
    operationalFunction: 'Atención Clínica de Hospitalización',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001064',
    specialtyTag: 'Cuidados Generales y Movilización',
    lastRosterCheckDemo: 'Fin de Semana · 07:00 hrs',
    supervisorObservations:
      'Adscrita en esquema de Jornada Acumulada (Sábado, Domingo y Días Festivos).',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División de Hospitalización Clínica (Demo)',
      serviceId: 'SRV-DEMO-03',
      serviceName: 'Hospitalización Medicina Interna (Demo)',
      positionCodeDemo: 'PLZ-SINT-AEG-412',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Jornada Acumulada',
      scheduleScheme: 'Jornada Acumulada',
      seniorityYearsDemo: 7,
    },
  },
  {
    employeeId: 'EMP-DEMO-007',
    employeeNumberDemo: 'MAT-SINT-90107',
    fullNameDemo: 'Fernando Castillo Nava (Demo)',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Cuidado Crítico e Intensivo',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001073',
    specialtyTag: 'Cardiología y Perfusión Tisular',
    lastRosterCheckDemo: 'Guardia Nocturna Activa',
    supervisorObservations: 'Cobertura de telemetría central en Terapia Intermedia.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División de Hospitalización Clínica (Demo)',
      serviceId: 'SRV-DEMO-04',
      serviceName: 'Terapia Intermedia y Cardiología (Demo)',
      positionCodeDemo: 'PLZ-SINT-EEC-425',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Nocturno',
      scheduleScheme: 'Guardia Nocturna',
      seniorityYearsDemo: 10,
    },
  },
  {
    employeeId: 'EMP-DEMO-008',
    employeeNumberDemo: 'MAT-SINT-90108',
    fullNameDemo: 'Carmen Espinosa Trejo (Demo)',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Enfermería Quirúrgica e Instrumentación',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001082',
    specialtyTag: 'Enfermería Perioperatoria',
    lastRosterCheckDemo: 'Hoy · 13:55 hrs',
    supervisorObservations: 'Instrumentista titular de salas quirúrgicas 1 y 2.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División Quirúrgica y Terapia Postoperatoria (Demo)',
      serviceId: 'SRV-DEMO-05',
      serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
      positionCodeDemo: 'PLZ-SINT-EEC-201',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Vespertino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 12,
    },
  },
  {
    employeeId: 'EMP-DEMO-009',
    employeeNumberDemo: 'MAT-SINT-90109',
    fullNameDemo: 'Raúl Mendoza Solís (Demo)',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Enfermería Quirúrgica e Instrumentación',
    employmentStatus: 'Licencia / Comisión',
    statusSeverity: 'warning',
    professionalLicenseDemo: 'CED-DEMO-001091',
    specialtyTag: 'Instrumentación Quirúrgica',
    lastRosterCheckDemo: 'Comisión Académica Simulada',
    supervisorObservations:
      'En comisión de actualización quirúrgica; plaza marcada en alerta de cobertura vespertina.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-01',
      hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
      divisionName: 'División Quirúrgica y Terapia Postoperatoria (Demo)',
      serviceId: 'SRV-DEMO-05',
      serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
      positionCodeDemo: 'PLZ-SINT-EEC-204',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Vespertino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 4,
    },
  },
  {
    employeeId: 'EMP-DEMO-010',
    employeeNumberDemo: 'MAT-SINT-90110',
    fullNameDemo: 'Natalia Peñaloza Cruz (Demo)',
    nominalCategory: 'Jefa(e) de Piso de Enfermería',
    operationalFunction: 'Supervisión Operativa de Piso',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001100',
    specialtyTag: 'Cuidados Intensivos Neonatales',
    lastRosterCheckDemo: 'Hoy · 06:50 hrs',
    supervisorObservations: 'Responsable de supervisión clínica en UCIN.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-02',
      hospitalName: 'Hospital de Especialidades Materno-Pediátrico (Demo)',
      divisionName: 'División de Pediatría y Neonatología (Demo)',
      serviceId: 'SRV-DEMO-07',
      serviceName: 'Unidad de Cuidados Intensivos Neonatales (Demo)',
      positionCodeDemo: 'PLZ-SINT-JP-501',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Matutino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 14,
    },
  },
  {
    employeeId: 'EMP-DEMO-011',
    employeeNumberDemo: 'MAT-SINT-90111',
    fullNameDemo: 'Daniel Orozco Luna (Demo)',
    nominalCategory: 'Enfermera(o) General Titulada(o) B',
    operationalFunction: 'Atención Clínica de Hospitalización',
    employmentStatus: 'Vacaciones Programadas',
    statusSeverity: 'warning',
    professionalLicenseDemo: 'CED-DEMO-001119',
    specialtyTag: 'Enfermería Pediátrica',
    lastRosterCheckDemo: 'Periodo Vacacional Ordinario',
    supervisorObservations: 'Periodo vacacional autorizado; cubierto con plantilla de suplencia.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-02',
      hospitalName: 'Hospital de Especialidades Materno-Pediátrico (Demo)',
      divisionName: 'División de Pediatría y Neonatología (Demo)',
      serviceId: 'SRV-DEMO-08',
      serviceName: 'Hospitalización Pediátrica General (Demo)',
      positionCodeDemo: 'PLZ-SINT-EGT-522',
      contractModalityDemo: 'Guardia / Suplencia Institucional (Demo)',
      baseShift: 'Vespertino',
      scheduleScheme: 'Horario Diurno',
      seniorityYearsDemo: 3,
    },
  },
  {
    employeeId: 'EMP-DEMO-012',
    employeeNumberDemo: 'MAT-SINT-90112',
    fullNameDemo: 'Arturo Villalobos Paz (Demo)',
    nominalCategory: 'Enfermera(o) Especialista C',
    operationalFunction: 'Enfermería Quirúrgica e Instrumentación',
    employmentStatus: 'Activo en Servicio',
    statusSeverity: 'optimal',
    professionalLicenseDemo: 'CED-DEMO-001128',
    specialtyTag: 'Cirugía Cardiovascular y Perfusión',
    lastRosterCheckDemo: 'Fin de Semana · 06:55 hrs',
    supervisorObservations: 'Adscrito a jornada acumulada quirúrgica de alta especialidad.',
    affiliation: {
      hospitalId: 'HOSP-DEMO-03',
      hospitalName: 'Centro de Alta Especialidad Quirúrgica Sur (Demo)',
      divisionName: 'División de Cirugía de Alta Complejidad (Demo)',
      serviceId: 'SRV-DEMO-10',
      serviceName: 'Pabellón de Cirugía Cardiovascular y Trasplantes (Demo)',
      positionCodeDemo: 'PLZ-SINT-EEC-601',
      contractModalityDemo: 'Base Institucional (Demo)',
      baseShift: 'Jornada Acumulada',
      scheduleScheme: 'Jornada Acumulada',
      seniorityYearsDemo: 9,
    },
  },
];

@Injectable({ providedIn: 'root' })
export class SyntheticPersonnelAdapter implements PersonnelGateway {
  public readonly adapterName = 'SyntheticPersonnelDemoAdapter (F2)';
  public readonly isSyntheticDemo = true;

  public queryPersonnel(criteria: PersonnelQueryCriteria): Observable<PersonnelQueryResult> {
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
          title: 'Fallo Simulado al Consultar Padrón de Personal',
          message:
            'Simulación F2: Interrupción al recuperar el directorio nominal y de adscripción hospitalaria.',
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
          title: 'Acceso Restringido al Módulo de Gestión de Personal',
          message:
            'Simulación F2 (HTTP 403): La consulta detallada de adscripción y plazas requiere nivel de Jefatura o Supervisión.',
          requiredRoleHint: 'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    const hospitalFilter = criteria.hospitalId ?? 'ALL';
    const serviceFilter = criteria.serviceId ?? 'ALL';
    const categoryFilter = criteria.nominalCategory ?? 'ALL';
    const statusFilter = criteria.employmentStatus ?? 'ALL';
    const query = (criteria.searchQuery ?? '').trim().toLowerCase();

    const filtered =
      simulatedState === 'empty'
        ? []
        : SYNTHETIC_STAFF_RECORDS.filter((rec) => {
            if (hospitalFilter !== 'ALL' && rec.affiliation.hospitalId !== hospitalFilter) {
              return false;
            }
            if (serviceFilter !== 'ALL' && rec.affiliation.serviceId !== serviceFilter) {
              return false;
            }
            if (categoryFilter !== 'ALL' && rec.nominalCategory !== categoryFilter) {
              return false;
            }
            if (statusFilter !== 'ALL' && rec.employmentStatus !== statusFilter) {
              return false;
            }
            if (query.length > 0) {
              return (
                rec.fullNameDemo.toLowerCase().includes(query) ||
                rec.employeeNumberDemo.toLowerCase().includes(query) ||
                rec.affiliation.serviceName.toLowerCase().includes(query) ||
                rec.nominalCategory.toLowerCase().includes(query) ||
                rec.operationalFunction.toLowerCase().includes(query)
              );
            }
            return true;
          });

    const pageSize = Math.max(1, criteria.pageSize ?? 5);
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, criteria.page ?? 1), totalPages);
    const startIdx = (currentPage - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

    const indicators = this.buildIndicators(filtered);

    const availableHospitals = SYNTHETIC_HOSPITALS.map((h) => ({
      id: h.hospitalId,
      name: h.hospitalName,
    }));
    const availableServices = SYNTHETIC_SERVICES.map((s) => ({
      id: s.serviceId,
      name: s.serviceName,
      hospitalId: s.hospitalId,
    }));

    if (totalItems === 0) {
      return of({
        state: 'empty',
        snapshot: {
          metadata: PERSONNEL_DEMO_METADATA,
          indicators,
          items: [],
          pagination: {
            currentPage: 1,
            pageSize,
            totalItems: 0,
            totalPages: 1,
            startItemIndex: 0,
            endItemIndex: 0,
          },
          selectedEmployee: null,
          availableHospitals,
          availableServices,
        },
        error: null,
      });
    }

    const selectedEmployee =
      filtered.find((e) => e.employeeId === criteria.selectedEmployeeId) ?? pagedItems[0];

    return of({
      state: 'ready',
      snapshot: {
        metadata: PERSONNEL_DEMO_METADATA,
        indicators,
        items: pagedItems,
        pagination: {
          currentPage,
          pageSize,
          totalItems,
          totalPages,
          startItemIndex: startIdx + 1,
          endItemIndex: Math.min(startIdx + pageSize, totalItems),
        },
        selectedEmployee,
        availableHospitals,
        availableServices,
      },
      error: null,
    });
  }

  private buildIndicators(records: readonly StaffMemberRecord[]): readonly KpiMetric[] {
    const total = records.length;
    const activeCount = records.filter((r) => r.employmentStatus === 'Activo en Servicio').length;
    const absentOrLeaveCount = total - activeCount;
    const specialistsCount = records.filter(
      (r) =>
        r.nominalCategory === 'Enfermera(o) Especialista C' ||
        r.nominalCategory === 'Jefa(e) de Piso de Enfermería',
    ).length;
    const activePct = total > 0 ? Math.round((activeCount / total) * 100) : 0;
    const specPct = total > 0 ? Math.round((specialistsCount / total) * 100) : 0;

    return [
      {
        id: 'pers-kpi-total',
        category: 'personal',
        label: 'Plantilla Filtrada en Padrón',
        value: total,
        formattedValue: `${total}`,
        unit: 'registros nominales',
        targetLabel: 'Padrón sintético F2 (12 plazas demo)',
        compliancePercentage: total > 0 ? 100 : 0,
        deltaLabel: 'Solo lectura demostrativa',
        trendDirection: 'neutral',
        status: 'optimal',
        summary: 'Efectivos registrados con adscripción institucional activa.',
      },
      {
        id: 'pers-kpi-active',
        category: 'asistencia',
        label: 'Personal Activo en Servicio',
        value: activeCount,
        formattedValue: `${activeCount} (${activePct}%)`,
        unit: 'en operación',
        targetLabel: 'Disponibilidad operativa ≥ 85%',
        compliancePercentage: activePct,
        deltaLabel: `${activeCount} de ${total} disponibles`,
        trendDirection: activePct >= 85 ? 'up' : 'down',
        status: activePct >= 85 ? 'optimal' : activePct >= 75 ? 'warning' : 'critical',
        summary: 'Personal en servicio activo sin licencia ni incapacidad vigente.',
      },
      {
        id: 'pers-kpi-leave',
        category: 'incidencias',
        label: 'Incapacidades, Licencias y Vacaciones',
        value: absentOrLeaveCount,
        formattedValue: `${absentOrLeaveCount}`,
        unit: 'ausencias justificadas',
        targetLabel: 'Con seguimiento de suplencia',
        compliancePercentage: Math.max(0, 100 - absentOrLeaveCount * 15),
        deltaLabel: absentOrLeaveCount > 0 ? 'Requiere enlace de guardia' : 'Sin ausencias',
        trendDirection: absentOrLeaveCount > 0 ? 'down' : 'up',
        status: absentOrLeaveCount > 2 ? 'warning' : 'optimal',
        summary: 'Personal temporalmente fuera de rol activo por causas administrativas o médicas.',
      },
      {
        id: 'pers-kpi-spec',
        category: 'cobertura',
        label: 'Especialistas y Jefaturas de Piso',
        value: specialistsCount,
        formattedValue: `${specialistsCount} (${specPct}%)`,
        unit: 'alta especialidad',
        targetLabel: 'Cobertura crítica y quirúrgica',
        compliancePercentage: specPct,
        deltaLabel: 'Cuidado crítico, UCIN y quirófano',
        trendDirection: 'up',
        status: 'optimal',
        summary: 'Proporción de personal con categoría nominal de especialista o jefatura.',
      },
    ];
  }
}
