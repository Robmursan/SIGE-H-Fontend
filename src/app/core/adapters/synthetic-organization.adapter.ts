import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DemoDataMetadata } from '../models/executive-dashboard.model';
import {
  HospitalDivision,
  HospitalInstitution,
  HospitalServiceUnit,
  OrganizationQueryCriteria,
  OrganizationQueryResult,
} from '../models/organization.model';
import { OrganizationGateway } from '../ports/organization.gateway';

const ORG_DEMO_METADATA: DemoDataMetadata = {
  isSyntheticDemo: true,
  datasetCode: 'SIGEH-DEMO-F2-ORG-2026',
  disclaimer:
    'Estructura organizacional 100% sintética para demostración ejecutiva F2. Respeta la jerarquía Hospital → División → Servicio sin datos institucionales reales.',
  simulatedHospitalUnit: 'Red Hospitalaria Modelo de Simulación SIGE-H (Demo F2)',
  simulatedRole: 'Jefatura de División de Enfermería (Solo Lectura F2)',
  generatedAtIso: '2026-11-15T16:00:00.000Z',
};

export const SYNTHETIC_HOSPITALS: readonly HospitalInstitution[] = [
  {
    hospitalId: 'HOSP-DEMO-01',
    hospitalCode: 'HGM-SINT-01',
    hospitalName: 'Hospital General Modelo Sintético Norte (Demo)',
    levelCode: 'Tercer Nivel Simulado',
    regionDemo: 'Zona Metropolitana Norte (Ficticia)',
    nursingDirectorDemo: 'Mtra. Elena Morales Vega (Perfil Sintético)',
    divisionsCount: 3,
    servicesCount: 6,
    activeStaffTotal: 148,
  },
  {
    hospitalId: 'HOSP-DEMO-02',
    hospitalCode: 'HEMP-SINT-02',
    hospitalName: 'Hospital de Especialidades Materno-Pediátrico (Demo)',
    levelCode: 'Segundo Nivel Especializado Simulado',
    regionDemo: 'Zona Centro Poniente (Ficticia)',
    nursingDirectorDemo: 'Lic. Enf. Roberto Navarro Soto (Perfil Sintético)',
    divisionsCount: 2,
    servicesCount: 3,
    activeStaffTotal: 86,
  },
  {
    hospitalId: 'HOSP-DEMO-03',
    hospitalCode: 'CAEQ-SINT-03',
    hospitalName: 'Centro de Alta Especialidad Quirúrgica Sur (Demo)',
    levelCode: 'Alta Especialidad Simulada',
    regionDemo: 'Zona Sur (Ficticia)',
    nursingDirectorDemo: 'Esp. Enf. Claudia Domínguez Ríos (Perfil Sintético)',
    divisionsCount: 2,
    servicesCount: 2,
    activeStaffTotal: 64,
  },
];

export const SYNTHETIC_DIVISIONS: readonly HospitalDivision[] = [
  {
    divisionId: 'DIV-DEMO-01',
    divisionCode: 'DIV-CRIT-01',
    divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionChiefDemo: 'Esp. Enf. Laura Méndez Pineda (Sintético)',
    servicesCount: 2,
    totalAuthorizedStaff: 54,
    totalActiveStaff: 51,
  },
  {
    divisionId: 'DIV-DEMO-02',
    divisionCode: 'DIV-HOSP-02',
    divisionName: 'División de Hospitalización Clínica (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionChiefDemo: 'Lic. Enf. Carlos Ibarra Ortiz (Sintético)',
    servicesCount: 2,
    totalAuthorizedStaff: 46,
    totalActiveStaff: 45,
  },
  {
    divisionId: 'DIV-DEMO-03',
    divisionCode: 'DIV-QUIR-03',
    divisionName: 'División Quirúrgica y Terapia Postoperatoria (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionChiefDemo: 'Esp. Enf. Patricia Lugo Serrano (Sintético)',
    servicesCount: 2,
    totalAuthorizedStaff: 48,
    totalActiveStaff: 42,
  },
  {
    divisionId: 'DIV-DEMO-04',
    divisionCode: 'DIV-PED-04',
    divisionName: 'División de Pediatría y Neonatología (Demo)',
    hospitalId: 'HOSP-DEMO-02',
    divisionChiefDemo: 'Mtra. Sofía Herrera Campos (Sintético)',
    servicesCount: 2,
    totalAuthorizedStaff: 56,
    totalActiveStaff: 54,
  },
  {
    divisionId: 'DIV-DEMO-05',
    divisionCode: 'DIV-GO-05',
    divisionName: 'División Gineco-Obstétrica y Tococirugía (Demo)',
    hospitalId: 'HOSP-DEMO-02',
    divisionChiefDemo: 'Lic. Enf. Miriam Reyes Luna (Sintético)',
    servicesCount: 1,
    totalAuthorizedStaff: 34,
    totalActiveStaff: 32,
  },
  {
    divisionId: 'DIV-DEMO-06',
    divisionCode: 'DIV-CIR-06',
    divisionName: 'División de Cirugía de Alta Complejidad (Demo)',
    hospitalId: 'HOSP-DEMO-03',
    divisionChiefDemo: 'Esp. Enf. Jorge Salgado Vera (Sintético)',
    servicesCount: 1,
    totalAuthorizedStaff: 36,
    totalActiveStaff: 34,
  },
  {
    divisionId: 'DIV-DEMO-07',
    divisionCode: 'DIV-REC-07',
    divisionName: 'División de Cuidados Postquirúrgicos (Demo)',
    hospitalId: 'HOSP-DEMO-03',
    divisionChiefDemo: 'Lic. Enf. Adriana Cano Ruiz (Sintético)',
    servicesCount: 1,
    totalAuthorizedStaff: 32,
    totalActiveStaff: 30,
  },
];

export const SYNTHETIC_SERVICES: readonly HospitalServiceUnit[] = [
  {
    serviceId: 'SRV-DEMO-01',
    serviceCode: 'UCIA-301',
    serviceName: 'Unidad de Cuidados Intensivos Adultos (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionId: 'DIV-DEMO-01',
    divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
    physicalLocation: 'Torre A · Piso 3 · Ala Oriente',
    careModality: 'Unidad Crítica',
    authorizedPositions: 24,
    activeStaffCount: 24,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno', 'Jornada Acumulada'],
    operationalStatus: 'optimal',
    operationalNotes:
      'Operación continua 24/7 con indicador enfermera-paciente 1:1 en cubículos de soporte vital simulado.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Esp. Enf. Gabriela Ríos Alcántara (Demo)',
        employeeCode: 'EMP-DEMO-001',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 4301',
      },
      {
        roleTitle: 'Supervisión Matutina',
        syntheticName: 'Lic. Enf. Héctor Vázquez Mora (Demo)',
        employeeCode: 'EMP-DEMO-002',
        shiftScope: 'Matutino',
        extensionDemo: 'Ext. 4302',
      },
      {
        roleTitle: 'Supervisión Nocturna',
        syntheticName: 'Esp. Enf. Diana Ponce Lara (Demo)',
        employeeCode: 'EMP-DEMO-003',
        shiftScope: 'Nocturno',
        extensionDemo: 'Ext. 4305',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-02',
    serviceCode: 'URG-101',
    serviceName: 'Urgencias y Triage Respiratorio (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionId: 'DIV-DEMO-01',
    divisionName: 'División de Áreas Críticas y Urgencias (Demo)',
    physicalLocation: 'Planta Baja · Acceso Norte',
    careModality: 'Ambulatorio y Urgencias',
    authorizedPositions: 30,
    activeStaffCount: 27,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno', 'Jornada Acumulada'],
    operationalStatus: 'warning',
    operationalNotes:
      '2 suplencias activas en filtro respiratorio y área de choque por incapacidad temporal sintética.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Lic. Enf. Marco Antonio Silva (Demo)',
        employeeCode: 'EMP-DEMO-004',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 4101',
      },
      {
        roleTitle: 'Supervisión Vespertina',
        syntheticName: 'Lic. Enf. Verónica Juárez Téllez (Demo)',
        employeeCode: 'EMP-DEMO-005',
        shiftScope: 'Vespertino',
        extensionDemo: 'Ext. 4104',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-03',
    serviceCode: 'MIN-401',
    serviceName: 'Hospitalización Medicina Interna (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionId: 'DIV-DEMO-02',
    divisionName: 'División de Hospitalización Clínica (Demo)',
    physicalLocation: 'Torre B · Piso 4',
    careModality: 'Hospitalización Continua 24h',
    authorizedPositions: 24,
    activeStaffCount: 23,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno'],
    operationalStatus: 'optimal',
    operationalNotes: 'Cobertura de 36 camas censables simuladas con rol de turno completo.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Lic. Enf. Rosa María Delgado (Demo)',
        employeeCode: 'EMP-DEMO-006',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 4410',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-04',
    serviceCode: 'CARD-402',
    serviceName: 'Terapia Intermedia y Cardiología (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionId: 'DIV-DEMO-02',
    divisionName: 'División de Hospitalización Clínica (Demo)',
    physicalLocation: 'Torre A · Piso 4',
    careModality: 'Unidad Crítica',
    authorizedPositions: 22,
    activeStaffCount: 22,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno', 'Jornada Acumulada'],
    operationalStatus: 'optimal',
    operationalNotes: 'Monitoreo telemétrico simulado al 100% de plantilla asignada.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Esp. Enf. Fernando Castillo Nava (Demo)',
        employeeCode: 'EMP-DEMO-007',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 4420',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-05',
    serviceCode: 'QUIR-201',
    serviceName: 'Quirófanos y Recuperación Postanestésica (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionId: 'DIV-DEMO-03',
    divisionName: 'División Quirúrgica y Terapia Postoperatoria (Demo)',
    physicalLocation: 'Torre A · Piso 2',
    careModality: 'Quirúrgico',
    authorizedPositions: 28,
    activeStaffCount: 23,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno', 'Jornada Acumulada'],
    operationalStatus: 'critical',
    operationalNotes:
      'Prioridad de supervisión: requiere cobertura de 2 plazas de enfermería quirúrgica en turno vespertino.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Esp. Enf. Carmen Espinosa Trejo (Demo)',
        employeeCode: 'EMP-DEMO-008',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 4201',
      },
      {
        roleTitle: 'Supervisión Vespertina',
        syntheticName: 'Esp. Enf. Raúl Mendoza Solís (Demo)',
        employeeCode: 'EMP-DEMO-009',
        shiftScope: 'Vespertino',
        extensionDemo: 'Ext. 4203',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-06',
    serviceCode: 'CEYE-202',
    serviceName: 'Central de Equipos y Esterilización CEYE (Demo)',
    hospitalId: 'HOSP-DEMO-01',
    divisionId: 'DIV-DEMO-03',
    divisionName: 'División Quirúrgica y Terapia Postoperatoria (Demo)',
    physicalLocation: 'Torre A · Piso 2 · Sub-ala Sur',
    careModality: 'Quirúrgico',
    authorizedPositions: 20,
    activeStaffCount: 19,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno'],
    operationalStatus: 'optimal',
    operationalNotes: 'Trazabilidad de instrumental quirúrgico simulado sin rezagos.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Lic. Enf. Leticia Tapia Gómez (Demo)',
        employeeCode: 'EMP-DEMO-010',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 4220',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-07',
    serviceCode: 'UCIN-101',
    serviceName: 'Unidad de Cuidados Intensivos Neonatales (Demo)',
    hospitalId: 'HOSP-DEMO-02',
    divisionId: 'DIV-DEMO-04',
    divisionName: 'División de Pediatría y Neonatología (Demo)',
    physicalLocation: 'Edificio Pediátrico · Piso 1',
    careModality: 'Unidad Crítica',
    authorizedPositions: 30,
    activeStaffCount: 29,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno', 'Jornada Acumulada'],
    operationalStatus: 'optimal',
    operationalNotes: 'Cobertura neonatal especializada completa en los tres turnos y jornada acumulada.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Esp. Enf. Natalia Peñaloza Cruz (Demo)',
        employeeCode: 'EMP-DEMO-011',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 5101',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-08',
    serviceCode: 'HPED-201',
    serviceName: 'Hospitalización Pediátrica General (Demo)',
    hospitalId: 'HOSP-DEMO-02',
    divisionId: 'DIV-DEMO-04',
    divisionName: 'División de Pediatría y Neonatología (Demo)',
    physicalLocation: 'Edificio Pediátrico · Piso 2',
    careModality: 'Hospitalización Continua 24h',
    authorizedPositions: 26,
    activeStaffCount: 25,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno'],
    operationalStatus: 'optimal',
    operationalNotes: 'Operación pediátrica sin incidencias críticas.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Lic. Enf. Daniel Orozco Luna (Demo)',
        employeeCode: 'EMP-DEMO-012',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 5201',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-09',
    serviceCode: 'TOCO-102',
    serviceName: 'Tococirugía y Alojamiento Conjunto (Demo)',
    hospitalId: 'HOSP-DEMO-02',
    divisionId: 'DIV-DEMO-05',
    divisionName: 'División Gineco-Obstétrica y Tococirugía (Demo)',
    physicalLocation: 'Ala Materna · Planta Baja',
    careModality: 'Quirúrgico',
    authorizedPositions: 34,
    activeStaffCount: 32,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno', 'Jornada Acumulada'],
    operationalStatus: 'warning',
    operationalNotes: '1 licencia programada en turno nocturno cubierta con rol de guardia.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Esp. Enf. Irene Sandoval Meza (Demo)',
        employeeCode: 'EMP-DEMO-013',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 5301',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-10',
    serviceCode: 'CAEQ-301',
    serviceName: 'Pabellón de Cirugía Cardiovascular y Trasplantes (Demo)',
    hospitalId: 'HOSP-DEMO-03',
    divisionId: 'DIV-DEMO-06',
    divisionName: 'División de Cirugía de Alta Complejidad (Demo)',
    physicalLocation: 'Torre Quirúrgica Sur · Piso 3',
    careModality: 'Quirúrgico',
    authorizedPositions: 36,
    activeStaffCount: 34,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno', 'Jornada Acumulada'],
    operationalStatus: 'optimal',
    operationalNotes: 'Salas de alta especialidad con dotación completa de perfusionistas e instrumentistas.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Esp. Enf. Arturo Villalobos Paz (Demo)',
        employeeCode: 'EMP-DEMO-014',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 6101',
      },
    ],
  },
  {
    serviceId: 'SRV-DEMO-11',
    serviceCode: 'UTPQ-201',
    serviceName: 'Terapia Postquirúrgica Especializada (Demo)',
    hospitalId: 'HOSP-DEMO-03',
    divisionId: 'DIV-DEMO-07',
    divisionName: 'División de Cuidados Postquirúrgicos (Demo)',
    physicalLocation: 'Torre Quirúrgica Sur · Piso 2',
    careModality: 'Unidad Crítica',
    authorizedPositions: 32,
    activeStaffCount: 30,
    enabledShifts: ['Matutino', 'Vespertino', 'Nocturno'],
    operationalStatus: 'optimal',
    operationalNotes: 'Vigilancia hemodinámica postoperatoria en parámetros óptimos.',
    responsibles: [
      {
        roleTitle: 'Jefatura de Servicio',
        syntheticName: 'Esp. Enf. Lucía Cervantes Gil (Demo)',
        employeeCode: 'EMP-DEMO-015',
        shiftScope: 'Coordinación General',
        extensionDemo: 'Ext. 6201',
      },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class SyntheticOrganizationAdapter implements OrganizationGateway {
  public readonly adapterName = 'SyntheticOrganizationDemoAdapter (F2)';
  public readonly isSyntheticDemo = true;

  public queryOrganization(
    criteria: OrganizationQueryCriteria,
  ): Observable<OrganizationQueryResult> {
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
          title: 'Fallo Simulado al Consultar Estructura Organizacional',
          message:
            'Simulación F2: No fue posible sincronizar el catálogo jerárquico de Hospitales, Divisiones y Servicios.',
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
          title: 'Acceso Restringido al Explorador Organizacional',
          message:
            'Simulación F2 (HTTP 403): Se requiere perfil de Supervisión o Jefatura para consultar la estructura y responsables por servicio.',
          requiredRoleHint: 'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    const activeHospitalId = criteria.hospitalId ?? SYNTHETIC_HOSPITALS[0].hospitalId;
    const selectedHospital =
      SYNTHETIC_HOSPITALS.find((h) => h.hospitalId === activeHospitalId) ??
      SYNTHETIC_HOSPITALS[0];

    const hospitalDivisions = SYNTHETIC_DIVISIONS.filter(
      (d) => d.hospitalId === selectedHospital.hospitalId,
    );

    if (simulatedState === 'empty') {
      return of({
        state: 'empty',
        snapshot: {
          metadata: ORG_DEMO_METADATA,
          hospitals: SYNTHETIC_HOSPITALS,
          selectedHospital,
          divisions: hospitalDivisions,
          services: [],
          selectedService: null,
        },
        error: null,
      });
    }

    const activeDivisionId = criteria.divisionId ?? 'ALL';
    const statusFilter = criteria.statusFilter ?? 'ALL';
    const query = (criteria.searchQuery ?? '').trim().toLowerCase();

    const filteredServices = SYNTHETIC_SERVICES.filter((srv) => {
      if (srv.hospitalId !== selectedHospital.hospitalId) {
        return false;
      }
      if (activeDivisionId !== 'ALL' && srv.divisionId !== activeDivisionId) {
        return false;
      }
      if (statusFilter !== 'ALL' && srv.operationalStatus !== statusFilter) {
        return false;
      }
      if (query.length > 0) {
        const matchesName = srv.serviceName.toLowerCase().includes(query);
        const matchesCode = srv.serviceCode.toLowerCase().includes(query);
        const matchesDivision = srv.divisionName.toLowerCase().includes(query);
        const matchesResponsible = srv.responsibles.some((r) =>
          r.syntheticName.toLowerCase().includes(query),
        );
        return matchesName || matchesCode || matchesDivision || matchesResponsible;
      }
      return true;
    });

    if (filteredServices.length === 0) {
      return of({
        state: 'empty',
        snapshot: {
          metadata: ORG_DEMO_METADATA,
          hospitals: SYNTHETIC_HOSPITALS,
          selectedHospital,
          divisions: hospitalDivisions,
          services: [],
          selectedService: null,
        },
        error: null,
      });
    }

    const selectedService =
      filteredServices.find((s) => s.serviceId === criteria.selectedServiceId) ??
      filteredServices[0];

    return of({
      state: 'ready',
      snapshot: {
        metadata: ORG_DEMO_METADATA,
        hospitals: SYNTHETIC_HOSPITALS,
        selectedHospital,
        divisions: hospitalDivisions,
        services: filteredServices,
        selectedService,
      },
      error: null,
    });
  }
}
