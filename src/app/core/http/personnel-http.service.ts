import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import {
  AssignmentPageDto,
  EmployeeDetailDto,
  EmployeePageDto,
  mapAssignmentReadDtoToDomain,
  mapEmployeeDetailDtoToDomain,
  mapEmployeePageDtoToSnapshot,
  ScopedStaffQueryParams,
} from '../contracts/openapi-dtos.contract';
import {
  ContractAssignmentsQueryCriteria,
  ContractAssignmentsQueryResult,
  EmployeeDetailQueryCriteria,
  EmployeeDetailQueryResult,
  PersonnelQueryCriteria,
  PersonnelQueryResult,
} from '../models/personnel.model';
import { PersonnelGateway } from '../ports/personnel.gateway';
import { AuthSessionService } from '../security/auth-session.service';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';
import { isValidUuid } from './organization-http.service';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string | undefined | null): value is string {
  if (!value || !ISO_DATE_REGEX.test(value.trim())) {
    return false;
  }
  const [y, m, d] = value.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Adaptador HTTP concreto para Gestión de Personal y Adscripciones (F4-C)
 * verificado contra `contracts/sigeh-v1.json` (L3B-2A):
 *
 * Operaciones reales integradas:
 * - `GET /api/v1/empleados` (`listScopedStaff`)
 * - `GET /api/v1/empleados/{empleadoId}` (`getScopedEmployee`)
 * - `GET /api/v1/contratos/{contratoId}/adscripciones` (`listScopedAssignments`)
 *
 * Reglas contractuales y de seguridad:
 * - Utiliza los ámbitos autorizados de `AuthSessionService` para formular consultas;
 *   NestJS es la única autoridad real de autorización multihospital.
 * - No inventa propiedades ni expone RUD o columnas excluidas del contrato.
 * - Valida UUIDs, fecha (`YYYY-MM-DD`) y rango `limit` (`1..100`) antes de despachar.
 */
@Injectable({ providedIn: 'root' })
export class PersonnelHttpService implements PersonnelGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);
  private readonly authSession = inject(AuthSessionService);

  public readonly adapterName = 'OpenApiV1PersonnelHttpGateway (F4-C)';
  public readonly isSyntheticDemo = false;

  /**
   * OperationId: `listScopedStaff` (`GET /api/v1/empleados`)
   */
  public listScopedStaff(params: ScopedStaffQueryParams): Observable<EmployeePageDto> {
    const validationErr = this.validateCommonScopeParams(params);
    if (validationErr) {
      return throwError(() => validationErr);
    }

    return this.openApiClient.getTyped<EmployeePageDto>('/api/v1/empleados', {
      queryParams: {
        hospitalId: params.hospitalId.trim(),
        servicioId: params.servicioId.trim(),
        fecha: params.fecha.trim(),
        divisionId: isValidUuid(params.divisionId) ? params.divisionId.trim() : undefined,
        cursor: isValidUuid(params.cursor) ? params.cursor.trim() : undefined,
        limit: this.normalizeLimit(params.limit),
      },
    });
  }

  /**
   * OperationId: `getScopedEmployee` (`GET /api/v1/empleados/{empleadoId}`)
   */
  public getScopedEmployee(
    empleadoId: string,
    params: ScopedStaffQueryParams,
  ): Observable<EmployeeDetailDto> {
    if (!isValidUuid(empleadoId)) {
      return throwError(() =>
        this.buildValidationError('El parámetro de ruta empleadoId debe ser un UUID válido.'),
      );
    }
    const validationErr = this.validateCommonScopeParams(params);
    if (validationErr) {
      return throwError(() => validationErr);
    }

    const encodedId = encodeURIComponent(empleadoId.trim());
    return this.openApiClient.getTyped<EmployeeDetailDto>(`/api/v1/empleados/${encodedId}`, {
      queryParams: {
        hospitalId: params.hospitalId.trim(),
        servicioId: params.servicioId.trim(),
        fecha: params.fecha.trim(),
        divisionId: isValidUuid(params.divisionId) ? params.divisionId.trim() : undefined,
        cursor: isValidUuid(params.cursor) ? params.cursor.trim() : undefined,
        limit: this.normalizeLimit(params.limit),
      },
    });
  }

  /**
   * OperationId: `listScopedAssignments` (`GET /api/v1/contratos/{contratoId}/adscripciones`)
   */
  public listScopedAssignments(
    contratoId: string,
    params: ScopedStaffQueryParams,
  ): Observable<AssignmentPageDto> {
    if (!isValidUuid(contratoId)) {
      return throwError(() =>
        this.buildValidationError('El parámetro de ruta contratoId debe ser un UUID válido.'),
      );
    }
    const validationErr = this.validateCommonScopeParams(params);
    if (validationErr) {
      return throwError(() => validationErr);
    }

    const encodedId = encodeURIComponent(contratoId.trim());
    return this.openApiClient.getTyped<AssignmentPageDto>(
      `/api/v1/contratos/${encodedId}/adscripciones`,
      {
        queryParams: {
          hospitalId: params.hospitalId.trim(),
          servicioId: params.servicioId.trim(),
          fecha: params.fecha.trim(),
          divisionId: isValidUuid(params.divisionId) ? params.divisionId.trim() : undefined,
          cursor: isValidUuid(params.cursor) ? params.cursor.trim() : undefined,
          limit: this.normalizeLimit(params.limit),
        },
      },
    );
  }

  public queryPersonnel(criteria: PersonnelQueryCriteria): Observable<PersonnelQueryResult> {
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

    const fecha = isValidIsoDate(criteria.fecha)
      ? criteria.fecha.trim()
      : new Date().toISOString().slice(0, 10);

    const limit = this.normalizeLimit(criteria.limit ?? criteria.pageSize);
    const cursor = isValidUuid(criteria.cursor) ? criteria.cursor.trim() : undefined;

    if (!isValidUuid(hospitalId) || !isValidUuid(servicioId)) {
      return of({
        state: 'error',
        snapshot: null,
        error: {
          code: 'BAD_REQUEST_VALIDATION',
          httpStatus: 400,
          title: 'Contexto Hospitalario y de Servicio Requerido',
          message:
            'Para consultar GET /api/v1/empleados se requiere una sesión IAM V2 con hospitalId y servicioId UUID autorizados desde /api/v1/auth/me.',
          timestampIso: new Date().toISOString(),
        },
      });
    }

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

    return this.listScopedStaff({
      hospitalId,
      servicioId,
      divisionId,
      fecha,
      cursor,
      limit,
    }).pipe(
      map((page): PersonnelQueryResult => {
        const snapshot = mapEmployeePageDtoToSnapshot(page, {
          hospitalId,
          servicioId,
          divisionId,
          fecha,
          availableHospitals,
          availableServices,
        });

        return {
          state: snapshot.items.length === 0 ? 'empty' : 'ready',
          snapshot,
          error: null,
        };
      }),
      catchError((err: NormalizedHttpError): Observable<PersonnelQueryResult> => {
        const failure = mapNormalizedErrorToQueryFailure(
          err,
          'Facultad de lectura de personal en el ámbito hospital/servicio autorizado',
        );
        return of({
          state: failure.state,
          snapshot: null,
          error: failure.error,
        });
      }),
    );
  }

  public getEmployeeDetail(
    criteria: EmployeeDetailQueryCriteria,
  ): Observable<EmployeeDetailQueryResult> {
    return this.getScopedEmployee(criteria.empleadoId, {
      hospitalId: criteria.hospitalId,
      servicioId: criteria.servicioId,
      divisionId: criteria.divisionId,
      fecha: criteria.fecha,
      cursor: criteria.cursor,
      limit: criteria.limit,
    }).pipe(
      map((dto): EmployeeDetailQueryResult => {
        const detail = mapEmployeeDetailDtoToDomain(dto, {
          hospitalId: criteria.hospitalId,
          servicioId: criteria.servicioId,
          divisionId: criteria.divisionId,
          fecha: criteria.fecha,
        });
        return {
          state: 'ready',
          detail,
          error: null,
        };
      }),
      catchError((err: NormalizedHttpError): Observable<EmployeeDetailQueryResult> => {
        const failure = mapNormalizedErrorToQueryFailure(
          err,
          'Facultad de lectura de detalle de empleado en el ámbito hospital/servicio autorizado',
        );
        return of({
          state: failure.state,
          detail: null,
          error: failure.error,
        });
      }),
    );
  }

  public listContractAssignments(
    criteria: ContractAssignmentsQueryCriteria,
  ): Observable<ContractAssignmentsQueryResult> {
    return this.listScopedAssignments(criteria.contratoId, {
      hospitalId: criteria.hospitalId,
      servicioId: criteria.servicioId,
      divisionId: criteria.divisionId,
      fecha: criteria.fecha,
      cursor: criteria.cursor,
      limit: criteria.limit,
    }).pipe(
      map((page): ContractAssignmentsQueryResult => {
        const items = page.items.map(mapAssignmentReadDtoToDomain);
        return {
          state: items.length === 0 ? 'empty' : 'ready',
          contratoId: criteria.contratoId,
          items,
          cursorPagination: {
            nextCursor: page.nextCursor,
            limit: page.limit,
            order: page.order,
          },
          error: null,
        };
      }),
      catchError((err: NormalizedHttpError): Observable<ContractAssignmentsQueryResult> => {
        const failure = mapNormalizedErrorToQueryFailure(
          err,
          'Facultad de lectura de adscripciones por contrato en el servicio autorizado',
        );
        return of({
          state: failure.state,
          contratoId: criteria.contratoId,
          items: [],
          cursorPagination: null,
          error: failure.error,
        });
      }),
    );
  }

  private validateCommonScopeParams(
    params: ScopedStaffQueryParams,
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
        'El parámetro fecha es obligatorio y debe tener formato YYYY-MM-DD válido.',
      );
    }
    if (params.divisionId !== undefined && params.divisionId !== '' && !isValidUuid(params.divisionId)) {
      return this.buildValidationError('El parámetro opcional divisionId debe ser un UUID válido.');
    }
    if (params.cursor !== undefined && params.cursor !== '' && !isValidUuid(params.cursor)) {
      return this.buildValidationError('El parámetro opcional cursor debe ser un UUID válido.');
    }
    if (params.limit !== undefined && (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100)) {
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
      title: 'Parámetros de Consulta Inválidos (HTTP 400)',
      message,
      timestampIso: new Date().toISOString(),
    };
  }
}
