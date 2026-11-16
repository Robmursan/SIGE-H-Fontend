import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OrganizationQueryCriteria,
  OrganizationQueryResult,
} from '../models/organization.model';

export interface OrganizationGateway {
  readonly adapterName: string;
  readonly isSyntheticDemo: boolean;
  queryOrganization(criteria: OrganizationQueryCriteria): Observable<OrganizationQueryResult>;
}

export const ORGANIZATION_GATEWAY = new InjectionToken<OrganizationGateway>(
  'ORGANIZATION_GATEWAY',
);
