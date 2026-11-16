import { Routes } from '@angular/router';
import { AccessDeniedPageComponent } from './features/access-denied/access-denied-page.component';
import { ExecutiveDashboardComponent } from './features/executive-dashboard/executive-dashboard.component';
import { OrganizationExplorerComponent } from './features/organization-explorer/organization-explorer.component';
import { PersonnelManagementComponent } from './features/personnel-management/personnel-management.component';
import { WorkSchedulingComponent } from './features/work-scheduling/work-scheduling.component';
import { InstitutionalShellComponent } from './layout/shell/institutional-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: InstitutionalShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: ExecutiveDashboardComponent,
        title: 'SIGE-H | Tablero Ejecutivo de Enfermería (Demo)',
      },
      {
        path: 'organizacion',
        component: OrganizationExplorerComponent,
        title: 'SIGE-H | Organización Hospitalaria (Demo F2)',
      },
      {
        path: 'personal',
        component: PersonnelManagementComponent,
        title: 'SIGE-H | Gestión de Personal (Demo F2)',
      },
      {
        path: 'programacion',
        component: WorkSchedulingComponent,
        title: 'SIGE-H | Programación Laboral Semanal (Demo F2)',
      },
      {
        path: 'acceso-restringido',
        component: AccessDeniedPageComponent,
        title: 'SIGE-H | Acceso Restringido (Demo 403)',
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
