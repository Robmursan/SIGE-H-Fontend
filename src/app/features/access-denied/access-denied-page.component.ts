import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardApiError } from '../../core/models/executive-dashboard.model';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-access-denied-page',
  imports: [UiStatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="access-denied-wrap" data-testid="access-denied-page">
      <app-ui-state-panel
        state="forbidden"
        [errorDetails]="forbiddenError"
        (restoreAccessRequested)="returnToDashboard()"
      />
    </div>
  `,
})
export class AccessDeniedPageComponent {
  private readonly router = inject(Router);

  protected readonly forbiddenError: DashboardApiError = {
    code: 'FORBIDDEN_ROLE',
    title: 'Vista de Demostración: Acceso Denegado por Rol (HTTP 403)',
    message:
      'Simulación de control de acceso institucional F1 (sin autenticación real activa). Esta pantalla valida el estado visual cuando un usuario sin nivel de Supervisión o Jefatura intenta acceder a módulos restringidos.',
    requiredRoleHint: 'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION',
    timestampIso: '2026-11-15T15:00:00.000Z',
  };

  public returnToDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }
}
