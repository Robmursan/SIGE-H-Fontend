import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import {
  mapPaseListaPageDtoToSnapshot,
  PaseListaPageDto,
  ScopedAttendanceRosterQueryParams,
} from '../contracts/openapi-dtos.contract';
import {
  AttendanceRosterQueryCriteria,
  AttendanceRosterQueryResult,
} from '../models/attendance-roster.model';
import { AttendanceRosterGateway } from '../ports/attendance-roster.gateway';
import { AuthSessionService } from '../security/auth-session.service';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';
import { isValidUuid } from './organization-http.service';
import { isValidIsoDate } from './personnel-http.service';

/**
 * Adaptador HTTP concreto para Consulta de Pases de Lista (F4-F · CU-ASI-01/02)
 * verificado contra `contracts/sigeh-v1.json` (21 operaciones):
 *
 * Operación real integrada (solo lectura en Coordinación):
 * - `GET /api/v1/pases-lista` (`listScopedAttendanceRoster`)
 *
 * Seguridad y facultades:
 * - No asume que `ASISTENCIA_CAPTURAR` autoriza lectura ni bloquea consultas en cliente;
 *   NestJS valida las facultades reales de lectura y el ámbito hospital/servicio.
 * - Preserva `eventoId` y `revision` como strings decimales BIGINT.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceRosterHttpService implements AttendanceRosterGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);
  private readonly authSession = inject(AuthSessionService);

  public readonly adapterName = 'OpenApiV1AttendanceRosterHttpGateway (F4-F)';
  public readonly isSyntheticDemo = false;

  /**
   * OperationId: `listScopedAttendanceRoster` (`GET /api/v1/pases-lista`)
   */
  public listScopedAttendanceRoster(
    params: ScopedAttendanceRosterQueryParams,
  ): Observable<PaseListaPageDto> {
    const validationErr = this.validateParams(params);
    if (validationErr) {
      return throwError(() => validationErr);
    }

    return this.openApiClient.getTyped<PaseListaPageDto>('/api/v1/pases-lista', {
      queryParams: {
        hospitalId: params.hospitalId.trim(),
        servicioId: params.servicioId.trim(),
        fecha: params.fecha.trim(),
        horarioId: isValidUuid(params.horarioId) ? params.horarioId.trim() : undefined,
        cursor: isValidUuid(params.cursor) ? params.cursor.trim() : undefined,
        limit: this.normalizeLimit(params.limit),
      },
    });
  }

  public queryAttendanceRoster(
    criteria: AttendanceRosterQueryCriteria,
  ): Observable<AttendanceRosterQueryResult> {
    const authCtx = this.authSession.selectedContext();

    const hospitalId = isValidUuid(criteria.hospitalId)
      ? criteria.hospitalId.trim()
      : authCtx?.hospitalId ?? '';

    const servicioId = isValidUuid(criteria.servicioId)
      ? criteria.servicioId.trim()
      : authCtx?.servicioId ?? '';

    const fecha = isValidIsoDate(criteria.fecha)
      ? criteria.fecha.trim()
      : new Date().toISOString().slice(0, 10);

    if (!isValidUuid(hospitalId) || !isValidUuid(servicioId)) {
      return of({
        state: 'error',
        snapshot: null,
        error: {
          code: 'BAD_REQUEST_VALIDATION',
          httpStatus: 400,
          title: 'Contexto Hospitalario y de Servicio Requerido',
          message:
            'Para consultar GET /api/v1/pases-lista se requiere una sesión IAM V2 con hospitalId y servicioId UUID autorizados desde /api/v1/auth/me.',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    return this.listScopedAttendanceRoster({
      hospitalId,
      servicioId,
      fecha,
      horarioId: criteria.horarioId,
      cursor: criteria.cursor,
      limit: criteria.limit,
    }).pipe(
      map((dto): AttendanceRosterQueryResult => {
        const snapshot = mapPaseListaPageDtoToSnapshot(dto);
        const filteredItems =
          criteria.estadoFilter && criteria.estadoFilter !== 'ALL'
            ? snapshot.items.filter((i) => i.estadoOperativo === criteria.estadoFilter)
            : snapshot.items;

        const finalSnapshot = {
          ...snapshot,
          items: filteredItems,
        };

        return {
          state: finalSnapshot.items.length === 0 ? 'empty' : 'ready',
          snapshot: finalSnapshot,
          error: null,
        };
      }),
      catchError((err: NormalizedHttpError): Observable<AttendanceRosterQueryResult> => {
        const failure = mapNormalizedErrorToQueryFailure(
          err,
          'Facultad de lectura de pases de lista en el ámbito hospital/servicio (evaluada por NestJS)',
        );
        return of({
          state: failure.state,
          snapshot: null,
          error: failure.error,
        });
      }),
    );
  }

  private validateParams(
    params: ScopedAttendanceRosterQueryParams,
  ): NormalizedHttpError | null {
    if (!isValidUuid(params.hospitalId)) {
      return this.buildValidationError(
        'El parámetro hospitalId es obligatorio y debe ser un UUID válido.',
      );
    }
    if (!isValidUuid(params.servicioId)) {
      return this.buildValidationError(
        'El parámetro servicioId es obligatorio y debe ser un UUID válido.',
      );
    }
    if (!isValidIsoDate(params.fecha)) {
      return this.buildValidationError(
        'El parámetro fecha es obligatorio y debe tener formato YYYY-MM-DD válido (fecha local del hospital).',
      );
    }
    if (
      params.horarioId !== undefined &&
      params.horarioId !== '' &&
      !isValidUuid(params.horarioId)
    ) {
      return this.buildValidationError('El parámetro opcional horarioId debe ser un UUID válido.');
    }
    if (params.cursor !== undefined && params.cursor !== '' && !isValidUuid(params.cursor)) {
      return this.buildValidationError('El parámetro opcional cursor debe ser un UUID válido.');
    }
    if (
      params.limit !== undefined &&
      (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100)
    ) {
      return this.buildValidationError('El parámetro limit debe ser un entero entre 1 y 100.');
    }
    return null;
  }

  private normalizeLimit(rawLimit: number | undefined): number {
    if (typeof rawLimit !== 'number' || !Number.isFinite(rawLimit)) {
      return 50;
    }
    return Math.min(100, Math.max(1, Math.trunc(rawLimit)));
  }

  private buildValidationError(message: string): NormalizedHttpError {
    return {
      status: 400,
      code: 'BAD_REQUEST_VALIDATION',
      title: 'Parámetros de Pase de Lista Inválidos (HTTP 400)',
      message,
      timestampIso: new Date().toISOString(),
    };
  }
}
