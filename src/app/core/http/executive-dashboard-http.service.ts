import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import {
  buildDefaultLocal168hWindow,
  mapProgrammingDashboardDtoToSnapshot,
  ProgrammingDashboardDto,
  ScopedCoordinationDashboardQueryParams,
  validateProgrammingWindow168h,
} from '../contracts/openapi-dtos.contract';
import {
  DashboardQueryCriteria,
  DashboardQueryResult,
} from '../models/executive-dashboard.model';
import { ExecutiveDashboardGateway } from '../ports/executive-dashboard.gateway';
import { AuthSessionService } from '../security/auth-session.service';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';
import { isValidUuid } from './organization-http.service';

/**
 * Adaptador HTTP concreto para el Tablero de Coordinación (F4-D) verificado
 * contra `contracts/sigeh-v1.json` (L3B-2A):
 *
 * Operación real integrada:
 * - `GET /api/v1/tableros/coordinacion` (`getScopedProgrammingIndicators`)
 *
 * Semántica estricta:
 * - Respuesta `ProgrammingDashboardDto` con `base: "PROGRAMACION_NO_ASISTENCIA_NI_COBERTURA"`.
 * - Jamás presenta métricas de programación como asistencia efectiva, cobertura
 *   realizada ni incidencias verificadas.
 */
@Injectable({ providedIn: 'root' })
export class ExecutiveDashboardHttpService implements ExecutiveDashboardGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);
  private readonly authSession = inject(AuthSessionService);

  public readonly adapterName = 'OpenApiV1CoordinationDashboardHttpGateway (F4-D)';
  public readonly isSyntheticDemo = false;

  /**
   * OperationId: `getScopedProgrammingIndicators` (`GET /api/v1/tableros/coordinacion`)
   */
  public getScopedProgrammingIndicators(
    params: ScopedCoordinationDashboardQueryParams,
  ): Observable<ProgrammingDashboardDto> {
    const validationErr = this.validateParams(params);
    if (validationErr) {
      return throwError(() => validationErr);
    }

    return this.openApiClient.getTyped<ProgrammingDashboardDto>('/api/v1/tableros/coordinacion', {
      queryParams: {
        hospitalId: params.hospitalId.trim(),
        servicioId: params.servicioId.trim(),
        divisionId: isValidUuid(params.divisionId) ? params.divisionId.trim() : undefined,
        desde: params.desde.trim(),
        hasta: params.hasta.trim(),
      },
    });
  }

  public queryDashboard(criteria: DashboardQueryCriteria): Observable<DashboardQueryResult> {
    const authCtx = this.authSession.selectedContext();

    const hospitalId = isValidUuid(criteria.hospitalId)
      ? criteria.hospitalId.trim()
      : authCtx?.hospitalId ?? '';

    const servicioId = isValidUuid(criteria.servicioId)
      ? criteria.servicioId.trim()
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
            'Para consultar GET /api/v1/tableros/coordinacion se requiere una sesión IAM V2 con hospitalId y servicioId UUID autorizados desde /api/v1/auth/me.',
          timestampIso: new Date().toISOString(),
        },
      });
    }

    const defaultWindow = buildDefaultLocal168hWindow();
    const desde = criteria.desde ?? defaultWindow.desde;
    const hasta = criteria.hasta ?? defaultWindow.hasta;

    return this.getScopedProgrammingIndicators({
      hospitalId,
      servicioId,
      divisionId,
      desde,
      hasta,
    }).pipe(
      map((dto): DashboardQueryResult => {
        const snapshot = mapProgrammingDashboardDtoToSnapshot(dto, {
          hospitalId,
          servicioId,
          divisionId,
          desde,
          hasta,
        });
        return {
          state: 'ready',
          snapshot,
          error: null,
        };
      }),
      catchError((err: NormalizedHttpError): Observable<DashboardQueryResult> => {
        const failure = mapNormalizedErrorToQueryFailure(
          err,
          'Facultad de lectura del tablero de coordinación en el ámbito hospital/servicio autorizado',
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
    params: ScopedCoordinationDashboardQueryParams,
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
    return null;
  }

  private buildValidationError(message: string): NormalizedHttpError {
    return {
      status: 400,
      code: 'BAD_REQUEST_VALIDATION',
      title: 'Parámetros de Tablero Inválidos (HTTP 400)',
      message,
      timestampIso: new Date().toISOString(),
    };
  }
}
