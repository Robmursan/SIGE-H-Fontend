import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import {
  mapOrganizationReferencePagesToSnapshot,
  OrganizationReferencePageDto,
  OrganizationReferenceQueryParams,
} from '../contracts/openapi-dtos.contract';
import {
  OrganizationQueryCriteria,
  OrganizationQueryResult,
} from '../models/organization.model';
import { OrganizationGateway } from '../ports/organization.gateway';
import { mapNormalizedErrorToQueryFailure } from './http-error-normalizer';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | undefined | null): value is string {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

/**
 * Adaptador HTTP concreto para Organización Hospitalaria verificado contra
 * `contracts/sigeh-v1.json` y `contracts/CONTRATO-SIGE-H-v1.md` (F3-B):
 *
 * Operaciones reales integradas:
 * - `GET /api/v1/hospitales` (`listAuthorizedHospitals`)
 * - `GET /api/v1/hospitales/{hospitalId}/divisiones` (`listAuthorizedDivisions`)
 * - `GET /api/v1/servicios` (`listAuthorizedServices`, `hospitalId` obligatorio)
 *
 * Respeta la proyección limitada (`identifiers-hierarchy-active-only`), no inventa
 * campos ni parámetros fuera del contrato y aplica estados de información no disponible
 * para atributos descriptivos aún pendientes de privilegios SQL.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationHttpService implements OrganizationGateway {
  private readonly openApiClient = inject(OpenApiClientBaseService);

  public readonly adapterName = 'OpenApiV1OrganizationHttpGateway (F3-B)';
  public readonly isSyntheticDemo = false;

  /**
   * OperationId: `listAuthorizedHospitals` (`GET /api/v1/hospitales`)
   */
  public listAuthorizedHospitals(
    params?: OrganizationReferenceQueryParams,
  ): Observable<OrganizationReferencePageDto> {
    return this.openApiClient.getTyped<OrganizationReferencePageDto>('/api/v1/hospitales', {
      queryParams: {
        hospitalId: isValidUuid(params?.hospitalId) ? params?.hospitalId : undefined,
        divisionId: isValidUuid(params?.divisionId) ? params?.divisionId : undefined,
        servicioId: isValidUuid(params?.servicioId) ? params?.servicioId : undefined,
        cursor: isValidUuid(params?.cursor) ? params?.cursor : undefined,
        limit: params?.limit,
      },
    });
  }

  /**
   * OperationId: `listAuthorizedDivisions` (`GET /api/v1/hospitales/{hospitalId}/divisiones`)
   */
  public listAuthorizedDivisions(
    hospitalId: string,
    params?: OrganizationReferenceQueryParams,
  ): Observable<OrganizationReferencePageDto> {
    const encodedHospitalId = encodeURIComponent(hospitalId);
    return this.openApiClient.getTyped<OrganizationReferencePageDto>(
      `/api/v1/hospitales/${encodedHospitalId}/divisiones`,
      {
        queryParams: {
          divisionId: isValidUuid(params?.divisionId) ? params?.divisionId : undefined,
          servicioId: isValidUuid(params?.servicioId) ? params?.servicioId : undefined,
          cursor: isValidUuid(params?.cursor) ? params?.cursor : undefined,
          limit: params?.limit,
        },
      },
    );
  }

  /**
   * OperationId: `listAuthorizedServices` (`GET /api/v1/servicios`)
   * Según `CONTRATO-SIGE-H-v1.md`: `hospitalId` es obligatorio.
   */
  public listAuthorizedServices(
    params: OrganizationReferenceQueryParams & { readonly hospitalId: string },
  ): Observable<OrganizationReferencePageDto> {
    return this.openApiClient.getTyped<OrganizationReferencePageDto>('/api/v1/servicios', {
      queryParams: {
        hospitalId: params.hospitalId,
        divisionId: isValidUuid(params.divisionId) ? params.divisionId : undefined,
        servicioId: isValidUuid(params.servicioId) ? params.servicioId : undefined,
        cursor: isValidUuid(params.cursor) ? params.cursor : undefined,
        limit: params.limit,
      },
    });
  }

  public queryOrganization(
    criteria: OrganizationQueryCriteria,
  ): Observable<OrganizationQueryResult> {
    const requestedHospitalUuid = isValidUuid(criteria.hospitalId)
      ? criteria.hospitalId
      : undefined;
    const requestedDivisionUuid =
      criteria.divisionId && criteria.divisionId !== 'ALL' && isValidUuid(criteria.divisionId)
        ? criteria.divisionId
        : undefined;
    const requestedServiceUuid = isValidUuid(criteria.servicioId)
      ? criteria.servicioId
      : undefined;
    const requestedCursorUuid = isValidUuid(criteria.cursor) ? criteria.cursor : undefined;
    const limit = criteria.limit ?? 50;

    return this.listAuthorizedHospitals({
      hospitalId: requestedHospitalUuid,
      limit,
    }).pipe(
      switchMap((hospitalsPage): Observable<OrganizationQueryResult> => {
        if (hospitalsPage.items.length === 0) {
          return of({
            state: 'empty',
            snapshot: null,
            error: null,
          });
        }

        const activeHospitalId =
          requestedHospitalUuid &&
          hospitalsPage.items.some((h) => h.hospitalId === requestedHospitalUuid)
            ? requestedHospitalUuid
            : hospitalsPage.items[0].hospitalId;

        return forkJoin({
          divisionsPage: this.listAuthorizedDivisions(activeHospitalId, {
            divisionId: requestedDivisionUuid,
            limit,
          }),
          servicesPage: this.listAuthorizedServices({
            hospitalId: activeHospitalId,
            divisionId: requestedDivisionUuid,
            servicioId: requestedServiceUuid,
            cursor: requestedCursorUuid,
            limit,
          }),
        }).pipe(
          map(({ divisionsPage, servicesPage }): OrganizationQueryResult => {
            const snapshot = mapOrganizationReferencePagesToSnapshot({
              hospitalsPage,
              divisionsPage,
              servicesPage,
              selectedHospitalId: activeHospitalId,
              selectedServiceId: criteria.selectedServiceId,
            });

            if (!snapshot) {
              return { state: 'empty', snapshot: null, error: null };
            }

            const statusFilter = criteria.statusFilter ?? 'ALL';
            const query = (criteria.searchQuery ?? '').trim().toLowerCase();

            const filteredServices = snapshot.services.filter((srv) => {
              if (statusFilter !== 'ALL' && srv.operationalStatus !== statusFilter) {
                return false;
              }
              if (query.length > 0) {
                return (
                  srv.serviceId.toLowerCase().includes(query) ||
                  srv.divisionId.toLowerCase().includes(query) ||
                  srv.hospitalId.toLowerCase().includes(query) ||
                  srv.serviceName.toLowerCase().includes(query)
                );
              }
              return true;
            });

            const finalSnapshot = {
              ...snapshot,
              services: filteredServices,
              selectedService:
                filteredServices.find((s) => s.serviceId === criteria.selectedServiceId) ??
                filteredServices[0] ??
                null,
            };

            return {
              state: filteredServices.length === 0 ? 'empty' : 'ready',
              snapshot: finalSnapshot,
              error: null,
            };
          }),
        );
      }),
      catchError((err: NormalizedHttpError): Observable<OrganizationQueryResult> => {
        const failure = mapNormalizedErrorToQueryFailure(
          err,
          'CATALOGOS_ADMINISTRAR (Alcance Hospitalario Persistido)',
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
