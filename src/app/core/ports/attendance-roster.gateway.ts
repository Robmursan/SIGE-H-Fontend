import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AttendanceRosterQueryCriteria,
  AttendanceRosterQueryResult,
} from '../models/attendance-roster.model';

export interface AttendanceRosterGateway {
  readonly adapterName: string;
  readonly isSyntheticDemo: boolean;
  queryAttendanceRoster(
    criteria: AttendanceRosterQueryCriteria,
  ): Observable<AttendanceRosterQueryResult>;
}

export const ATTENDANCE_ROSTER_GATEWAY = new InjectionToken<AttendanceRosterGateway>(
  'ATTENDANCE_ROSTER_GATEWAY',
);
