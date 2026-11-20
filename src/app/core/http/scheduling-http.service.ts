import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import {
  buildDefaultLocal168hWindow,
  mapSchedulePageDtoToSnapshot,
  SchedulePageDto,
  ScopedProgrammingQueryParams,
  validateProgrammingWindow168h,
} from '../contracts/openapi-dtos.contract';
import {
  SchedulingQueryCriteria,
  SchedulingQueryResult,
} from '../models/scheduling.model';
import { SchedulingGateway } from '../ports/scheduling.gateway';
import { AuthSessionService } from '../security/auth-session.service';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';
import { isValidUuid } from './organization-http.service';

/**
 * Adaptador HTTP concreto para Programación Laboral (F4-D) verificado contra
 * `contracts/sigeh-v1.json` (L3B-2A):
 *
 * Operación real integrada:
 * - `GET /api/v1/programaciones` (`listScopedWeeklyProgramming`)
 *
 * Parámetros contractuales exactos:
 * - Obligatorios: `hospitalId` (UUID), `servicioId` (UUID), `desde` (ISO-8601 con zona/offset),
 *   `hasta` (ISO-8601 con zona/offset, ventana máxima 168 horas).
 * - Opcionales: `divisionId` (UUID), `cursor` (UUID), `limit` (`1..100`, default `50`).
 */
@Injectable({ providedIn: 'root' })
export class SchedulingHttpService implements SchedulingGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);
  private readonly authSession = inject(AuthSessionService);

  public readonly adapterName = 'OpenApiV1SchedulingHttpGateway (F4-D)';
  public readonly isSyntheticDemo = false;

  /**
   * OperationId: `listScopedWeeklyProgramming` (`GET /api/v1/programaciones`)
   */
  public listScopedWeeklyProgramming(
    params: ScopedProgrammingQueryParams,
  ): Observable<SchedulePageDto> {
    const validationErr = this.validateParams(params);
    if (validationErr) {
      return throwError(() => validationErr);
    }

    return this.openApiClient.getTyped<SchedulePageDto>('/api/v1/programaciones', {
      queryParams: {
        hospitalId: params.hospitalId.trim(),
        servicioId: params.servicioId.trim(),
        divisionId: isValidUuid(params.divisionId) ? params.divisionId.trim() : undefined,
        desde: params.desde.trim(),
        hasta: params.hasta.trim(),
        cursor: isValidUuid(params.cursor) ? params.cursor.trim() : undefined,
        limit: this.normalizeLimit(params.limit),
      },
    });
  }

  public queryWeeklySchedule(
    criteria: SchedulingQueryCriteria,
  ): Observable<SchedulingQueryResult> {
    const authCtx = this.authSession.selectedContext();

    const hospitalId =
      criteria.hospitalId && criteria.hospitalId !== 'ALL' && isValidUuid(criteria.hospitalId)
        ? criteria.hospitalId.trim()
        : authCtx?.hospitalId ?? '';

    const servicioId =
      criteria.serviceId && criteria.serviceId !== 'ALL' && isValidUuid(criteria.serviceId)
        ? criteria.serviceId.trim()
        : authCtx?.servicioId ?? '';

    const divisionId = isValidUuid(criteria.divisionId)
      ? criteria.divisionId.trim()
      : authCtx?.divisionId ?? undefined;

    if (!isValidUuid(hospitalId) || !isValidUuid(servicioId)) {
      return of({
        state: 'error',
        snapshot: null,
        error: {
          code: 'BAD_REQUEST_VALIDATION',
          httpStatus: 400,
          title: 'Contexto Hospitalario y de Servicio Requerido',
          message:
            'Para consultar GET /api/v1/programaciones se requiere una sesión IAM V2 con hospitalId y servicioId UUID autorizados desde /api/v1/auth/me.',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    const defaultWindow = buildDefaultLocal168hWindow();
    const desde = criteria.desde ?? defaultWindow.desde;
    const hasta = criteria.hasta ?? defaultWindow.hasta;
    const limit = this.normalizeLimit(criteria.limit);
    const cursor = criteria.cursor;

    const availableHospitals = this.authSession.authorizedHospitals().map((h) => ({
      id: h.hospitalId,
      name: h.displayLabel,
    }));
    const availableServices = this.authSession
      .authorizedHospitals()
      .flatMap((h) =>
        h.explicitServices.map((s) => ({
          id: s.servicioId,
          name: s.displayLabel,
          hospitalId: h.hospitalId,
        })),
      );

    return this.listScopedWeeklyProgramming({
      hospitalId,
      servicioId,
      divisionId,
      desde,
      hasta,
      cursor,
      limit,
    }).pipe(
      map((page): SchedulingQueryResult => {
        const snapshot = mapSchedulePageDtoToSnapshot(page, {
          hospitalId,
          servicioId,
          divisionId,
          desde,
          hasta,
          availableHospitals,
          availableServices,
        });
        const itemsCount = snapshot.scopedItems?.length ?? 0;
        return {
          state: itemsCount === 0 ? 'empty' : 'ready',
          snapshot,
          error: null,
        };
      }),
      catchError((err: NormalizedHttpError): Observable<SchedulingQueryResult> => {
        const failure = mapNormalizedErrorToQueryFailure(
          err,
          'Facultad de lectura de programación en el ámbito hospital/servicio autorizado',
        );
        return of({
          state: failure.state,
          snapshot: null,
          error: failure.error,
        });
      }),
    );
  }

  private validateParams(params: ScopedProgrammingQueryParams): NormalizedHttpError | null {
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
    if (
      params.divisionId !== undefined &&
      params.divisionId !== '' &&
      !isValidUuid(params.divisionId)
    ) {
      return this.buildValidationError('El parámetro opcional divisionId debe ser un UUID válido.');
    }
    const windowCheck = validateProgrammingWindow168h(params.desde, params.hasta);
    if (!windowCheck.valid) {
      return this.buildValidationError(
        windowCheck.errorMessage ?? 'Ventana desde/hasta inválida.',
      );
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
    const rounded = Math.trunc(rawLimit);
    if (rounded < 1) {
      return 1;
    }
    if (rounded > 100) {
      return 100;
    }
    return rounded;
  }

  private buildValidationError(message: string): NormalizedHttpError {
    return {
      status: 400,
      code: 'BAD_REQUEST_VALIDATION',
      title: 'Parámetros de Programación Inválidos (HTTP 400)',
      message,
      timestampIso: new Date().toISOString(),
    };
  }
}
