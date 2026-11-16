import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import {
  SchedulingQueryCriteria,
  SchedulingQueryResult,
  WeeklyScheduleSnapshot,
} from '../models/scheduling.model';
import { SchedulingGateway } from '../ports/scheduling.gateway';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';

/**
 * Cliente HTTP tipado preparado para consumir el contrato OpenAPI de Programación
 * Laboral Semanal (horarios diurnos, acumulados, guardias nocturnas y alertas).
 */
@Injectable({ providedIn: 'root' })
export class SchedulingHttpService implements SchedulingGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);

  public readonly adapterName = 'OpenApiSchedulingHttpGateway (Preparado F3-A)';
  public readonly isSyntheticDemo = false;

  public queryWeeklySchedule(
    criteria: SchedulingQueryCriteria,
    contractOperationPath = '/openapi-pending-contract/weekly-scheduling',
  ): Observable<SchedulingQueryResult> {
    return this.openApiClient
      .getTyped<WeeklyScheduleSnapshot>(contractOperationPath, {
        queryParams: {
          hospitalId: criteria.hospitalId,
          serviceId: criteria.serviceId,
          shiftFilter: criteria.shiftFilter,
          schemeFilter: criteria.schemeFilter,
          searchQuery: criteria.searchQuery,
        },
      })
      .pipe(
        map((snapshot): SchedulingQueryResult => ({
          state: snapshot.rows.length === 0 ? 'empty' : 'ready',
          snapshot,
          error: null,
        })),
        catchError((err: NormalizedHttpError): Observable<SchedulingQueryResult> => {
          const failure = mapNormalizedErrorToQueryFailure(
            err,
            'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_SERVICIO',
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
