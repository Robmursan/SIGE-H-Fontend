import { Routes } from '@angular/router';
import { iamAuthGuard } from './core/security/iam-auth.guard';
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
        path: 'login',
        loadComponent: () =>
          import('./features/auth-login/auth-login.component').then(
            (m) => m.AuthLoginComponent,
          ),
        title: 'SIGE-H | Acceso IAM V2 y Contexto Hospitalario',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/executive-dashboard/executive-dashboard.component').then(
            (m) => m.ExecutiveDashboardComponent,
          ),
        canActivate: [iamAuthGuard],
        title: 'SIGE-H | Tablero Ejecutivo de Enfermería (Demo)',
      },
      {
        path: 'organizacion',
        loadComponent: () =>
          import('./features/organization-explorer/organization-explorer.component').then(
            (m) => m.OrganizationExplorerComponent,
          ),
        canActivate: [iamAuthGuard],
        title: 'SIGE-H | Organización Hospitalaria (Demo F2)',
      },
      {
        path: 'personal',
        loadComponent: () =>
          import('./features/personnel-management/personnel-management.component').then(
            (m) => m.PersonnelManagementComponent,
          ),
        canActivate: [iamAuthGuard],
        title: 'SIGE-H | Gestión de Personal (Demo F2)',
      },
      {
        path: 'programacion',
        loadComponent: () =>
          import('./features/work-scheduling/work-scheduling.component').then(
            (m) => m.WorkSchedulingComponent,
          ),
        canActivate: [iamAuthGuard],
        title: 'SIGE-H | Programación Laboral Semanal (Demo F2)',
      },
      {
        path: 'pases-lista',
        loadComponent: () =>
          import('./features/attendance-roster/attendance-roster.component').then(
            (m) => m.AttendanceRosterComponent,
          ),
        canActivate: [iamAuthGuard],
        title: 'SIGE-H | Consulta de Pases de Lista (Coordinación F4-F)',
      },
      {
        path: 'acceso-restringido',
        loadComponent: () =>
          import('./features/access-denied/access-denied-page.component').then(
            (m) => m.AccessDeniedPageComponent,
          ),
        title: 'SIGE-H | Acceso Restringido (Demo 403)',
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
