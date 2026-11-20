import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ContractAssignmentsQueryCriteria,
  ContractAssignmentsQueryResult,
  EmployeeDetailQueryCriteria,
  EmployeeDetailQueryResult,
  PersonnelQueryCriteria,
  PersonnelQueryResult,
} from '../models/personnel.model';

export interface PersonnelGateway {
  readonly adapterName: string;
  readonly isSyntheticDemo: boolean;
  queryPersonnel(criteria: PersonnelQueryCriteria): Observable<PersonnelQueryResult>;
  getEmployeeDetail(criteria: EmployeeDetailQueryCriteria): Observable<EmployeeDetailQueryResult>;
  listContractAssignments(
    criteria: ContractAssignmentsQueryCriteria,
  ): Observable<ContractAssignmentsQueryResult>;
}

export const PERSONNEL_GATEWAY = new InjectionToken<PersonnelGateway>(
  'PERSONNEL_GATEWAY',
);
