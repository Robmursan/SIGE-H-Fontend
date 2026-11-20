import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  AttendanceRosterItem,
  AttendanceRosterQueryCriteria,
  AttendanceRosterQueryResult,
} from '../models/attendance-roster.model';
import { AttendanceRosterGateway } from '../ports/attendance-roster.gateway';

const SYNTHETIC_ROSTER_ITEMS: readonly AttendanceRosterItem[] = [
  {
    programacionId: 'PROG-DEMO-101',
    empleado: {
      empleadoId: 'EMP-DEMO-001',
      nombres: 'Gabriela',
      primerApellido: 'Ríos (Demo)',
      fullName: 'Gabriela Ríos (Demo)',
    },
    horarioId: 'HOR-DEMO-MAT',
    turnoCodigo: 'MAT',
    inicioProgramado: '2026-11-18T07:00:00-06:00',
    finProgramado: '2026-11-18T15:00:00-06:00',
    estadoProgramacion: 'PROGRAMADA',
    capturada: true,
    asistenciaId: 'ASI-DEMO-9001',
    estadoOperativo: 'PRESENTE',
    validacionAdministrativa: 'PENDIENTE',
    revision: '1',
    ultimaCaptura: {
      eventoId: '1000000000001',
      actorId: 'ACTOR-DEMO-SUP-01',
      registradoEn: '2026-11-18T07:12:00-06:00',
    },
    capturable: false,
    motivoNoCapturable: 'YA_REGISTRADA',
  },
  {
    programacionId: 'PROG-DEMO-102',
    empleado: {
      empleadoId: 'EMP-DEMO-002',
      nombres: 'Carlos',
      primerApellido: 'Mendoza (Demo)',
      fullName: 'Carlos Mendoza (Demo)',
    },
    horarioId: 'HOR-DEMO-MAT',
    turnoCodigo: 'MAT',
    inicioProgramado: '2026-11-18T07:00:00-06:00',
    finProgramado: '2026-11-18T15:00:00-06:00',
    estadoProgramacion: 'PROGRAMADA',
    capturada: true,
    asistenciaId: 'ASI-DEMO-9002',
    estadoOperativo: 'PARCIAL',
    validacionAdministrativa: 'PENDIENTE',
    revision: '1',
    ultimaCaptura: {
      eventoId: '1000000000002',
      actorId: 'ACTOR-DEMO-SUP-01',
      registradoEn: '2026-11-18T07:25:00-06:00',
    },
    capturable: false,
    motivoNoCapturable: 'YA_REGISTRADA',
  },
  {
    programacionId: 'PROG-DEMO-103',
    empleado: {
      empleadoId: 'EMP-DEMO-003',
      nombres: 'Lucía',
      primerApellido: 'Paredes (Demo)',
      fullName: 'Lucía Paredes (Demo)',
    },
    horarioId: 'HOR-DEMO-MAT',
    turnoCodigo: 'MAT',
    inicioProgramado: '2026-11-18T07:00:00-06:00',
    finProgramado: '2026-11-18T15:00:00-06:00',
    estadoProgramacion: 'PROGRAMADA',
    capturada: true,
    asistenciaId: 'ASI-DEMO-9003',
    estadoOperativo: 'AUSENTE',
    validacionAdministrativa: 'PENDIENTE',
    revision: '1',
    ultimaCaptura: {
      eventoId: '1000000000003',
      actorId: 'ACTOR-DEMO-SUP-01',
      registradoEn: '2026-11-18T07:31:00-06:00',
    },
    capturable: false,
    motivoNoCapturable: 'YA_REGISTRADA',
  },
  {
    programacionId: 'PROG-DEMO-104',
    empleado: {
      empleadoId: 'EMP-DEMO-004',
      nombres: 'Martín',
      primerApellido: 'Salazar (Demo)',
      fullName: 'Martín Salazar (Demo)',
    },
    horarioId: 'HOR-DEMO-VES',
    turnoCodigo: 'VES',
    inicioProgramado: '2026-11-18T14:00:00-06:00',
    finProgramado: '2026-11-18T21:30:00-06:00',
    estadoProgramacion: 'PROGRAMADA',
    capturada: false,
    asistenciaId: null,
    estadoOperativo: 'PENDIENTE',
    validacionAdministrativa: null,
    revision: '0',
    ultimaCaptura: null,
    capturable: false,
    motivoNoCapturable: 'SIN_FACULTAD_CAPTURA',
  },
];

@Injectable({ providedIn: 'root' })
export class SyntheticAttendanceRosterAdapter implements AttendanceRosterGateway {
  public readonly adapterName = 'SyntheticAttendanceRosterAdapter (Demo F4-F)';
  public readonly isSyntheticDemo = true;

  public queryAttendanceRoster(
    criteria: AttendanceRosterQueryCriteria,
  ): Observable<AttendanceRosterQueryResult> {
    if (criteria.simulatedState === 'loading') {
      return of({ state: 'loading', snapshot: null, error: null });
    }
    if (criteria.simulatedState === 'empty') {
      return of({ state: 'empty', snapshot: null, error: null });
    }
    if (criteria.simulatedState === 'error') {
      return of({
        state: 'error',
        snapshot: null,
        error: {
          code: 'SYNTHETIC_SIMULATED_ERROR',
          httpStatus: 503,
          title: 'Error Simulado de Consulta de Pases de Lista',
          message: 'Estado de error sintético para inspección visual en modo demostración.',
          timestampIso: new Date().toISOString(),
        },
      });
    }
    if (criteria.simulatedState === 'forbidden') {
      return of({
        state: 'forbidden',
        snapshot: null,
        error: {
          code: 'FORBIDDEN_ROLE',
          httpStatus: 403,
          title: 'Acceso Restringido a Pases de Lista (Simulado 403)',
          message:
            'El perfil simulado no cuenta con facultad de lectura de pases de lista en este servicio.',
          requiredRoleHint: 'Facultad de lectura en ámbito hospital/servicio (NestJS)',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    const filtered =
      criteria.estadoFilter && criteria.estadoFilter !== 'ALL'
        ? SYNTHETIC_ROSTER_ITEMS.filter((i) => i.estadoOperativo === criteria.estadoFilter)
        : SYNTHETIC_ROSTER_ITEMS;

    if (filtered.length === 0) {
      return of({ state: 'empty', snapshot: null, error: null });
    }

    return of({
      state: 'ready',
      snapshot: {
        metadata: {
          isSyntheticDemo: true,
          datasetCode: 'SIGEH-DEMO-F4F-PASES-LISTA-2026',
          disclaimer:
            'Pases de lista 100% sintéticos de demostración. No corresponde a capturas reales de PostgreSQL.',
          simulatedHospitalUnit: 'Hospital General Modelo Sintético Norte (Demo)',
          simulatedRole: 'Coordinación de Enfermería (Solo Lectura Demo)',
          generatedAtIso: new Date().toISOString(),
        },
        hospitalId: 'HOSP-DEMO-01',
        servicioId: 'SRV-DEMO-UCIA',
        fecha: criteria.fecha || '2026-11-18',
        zonaHoraria: 'America/Mexico_City',
        items: filtered,
        cursorPagination: {
          nextCursor: null,
          limit: criteria.limit ?? 50,
          order: 'id:asc',
        },
      },
      error: null,
    });
  }
}
