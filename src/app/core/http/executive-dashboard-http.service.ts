import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import {
  DashboardQueryCriteria,
  DashboardQueryResult,
  ExecutiveDashboardSnapshot,
} from '../models/executive-dashboard.model';
import { ExecutiveDashboardGateway } from '../ports/executive-dashboard.gateway';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';

/**
 * Adaptador HTTP tipado listo para conectarse al contrato OpenAPI del Tablero Ejecutivo.
 * No inventa rutas reales del backend; delega en `OpenApiClientBaseService` con manejo
 * uniforme de estados 401, 403, 404, 409 y 500.
 */
@Injectable({ providedIn: 'root' })
export class ExecutiveDashboardHttpService implements ExecutiveDashboardGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);

  public readonly adapterName = 'OpenApiTypedHttpGateway (Preparado F3-A)';
  public readonly isSyntheticDemo = false;

  public queryDashboard(
    criteria: DashboardQueryCriteria,
    contractOperationPath = '/openapi-pending-contract/executive-dashboard',
  ): Observable<DashboardQueryResult> {
    return this.openApiClient
      .getTyped<ExecutiveDashboardSnapshot>(contractOperationPath, {
        queryParams: {
          shift: criteria.shift,
          serviceQuery: criteria.serviceQuery,
          statusFilter: criteria.statusFilter,
        },
      })
      .pipe(
        map((snapshot): DashboardQueryResult => {
          const isEmpty =
            snapshot.serviceCoverage.length === 0 && snapshot.incidents.length === 0;
          return {
            state: isEmpty ? 'empty' : 'ready',
            snapshot,
            error: null,
          };
        }),
        catchError((err: NormalizedHttpError): Observable<DashboardQueryResult> => {
          const failure = mapNormalizedErrorToQueryFailure(
            err,
            'Jefatura de Enfermería / Supervisión General de Turno',
          );
          return of({
            state: failure.state,
            snapshot: null,
            error: failure.error,
          });
        }),
      );
  }
}
