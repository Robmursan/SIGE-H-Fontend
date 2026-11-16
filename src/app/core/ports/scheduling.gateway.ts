import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  SchedulingQueryCriteria,
  SchedulingQueryResult,
} from '../models/scheduling.model';

export interface SchedulingGateway {
  readonly adapterName: string;
  readonly isSyntheticDemo: boolean;
  queryWeeklySchedule(criteria: SchedulingQueryCriteria): Observable<SchedulingQueryResult>;
}

export const SCHEDULING_GATEWAY = new InjectionToken<SchedulingGateway>(
  'SCHEDULING_GATEWAY',
);
