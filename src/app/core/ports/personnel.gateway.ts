import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PersonnelQueryCriteria,
  PersonnelQueryResult,
} from '../models/personnel.model';

export interface PersonnelGateway {
  readonly adapterName: string;
  readonly isSyntheticDemo: boolean;
  queryPersonnel(criteria: PersonnelQueryCriteria): Observable<PersonnelQueryResult>;
}

export const PERSONNEL_GATEWAY = new InjectionToken<PersonnelGateway>(
  'PERSONNEL_GATEWAY',
);
