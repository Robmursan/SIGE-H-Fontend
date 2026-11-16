import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardQueryCriteria,
  DashboardQueryResult,
} from '../models/executive-dashboard.model';

/**
 * Puerto de dominio (Hexagonal / Clean Frontend) que desacopla la vista del
 * Dashboard Ejecutivo respecto al origen de datos (Adaptador Sintético F1 vs
 * Servicio HTTP OpenAPI en fases posteriores).
 */
export interface ExecutiveDashboardGateway {
  readonly adapterName: string;
  readonly isSyntheticDemo: boolean;
  queryDashboard(criteria: DashboardQueryCriteria): Observable<DashboardQueryResult>;
}

export const EXECUTIVE_DASHBOARD_GATEWAY = new InjectionToken<ExecutiveDashboardGateway>(
  'EXECUTIVE_DASHBOARD_GATEWAY',
);
