import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import {
  PersonnelDirectorySnapshot,
  PersonnelQueryCriteria,
  PersonnelQueryResult,
} from '../models/personnel.model';
import { PersonnelGateway } from '../ports/personnel.gateway';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';

/**
 * Cliente HTTP tipado preparado para consumir el contrato OpenAPI de Gestión
 * de Personal (solo lectura hasta habilitación de endpoints y autorización).
 */
@Injectable({ providedIn: 'root' })
export class PersonnelHttpService implements PersonnelGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);

  public readonly adapterName = 'OpenApiPersonnelHttpGateway (Preparado F3-A)';
  public readonly isSyntheticDemo = false;

  public queryPersonnel(
    criteria: PersonnelQueryCriteria,
    contractOperationPath = '/openapi-pending-contract/personnel-directory',
  ): Observable<PersonnelQueryResult> {
    return this.openApiClient
      .getTyped<PersonnelDirectorySnapshot>(contractOperationPath, {
        queryParams: {
          hospitalId: criteria.hospitalId,
          serviceId: criteria.serviceId,
          nominalCategory: criteria.nominalCategory,
          employmentStatus: criteria.employmentStatus,
          searchQuery: criteria.searchQuery,
          page: criteria.page,
          pageSize: criteria.pageSize,
          selectedEmployeeId: criteria.selectedEmployeeId,
        },
      })
      .pipe(
        map((snapshot): PersonnelQueryResult => ({
          state: snapshot.items.length === 0 ? 'empty' : 'ready',
          snapshot,
          error: null,
        })),
        catchError((err: NormalizedHttpError): Observable<PersonnelQueryResult> => {
          const failure = mapNormalizedErrorToQueryFailure(
            err,
            'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION',
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
