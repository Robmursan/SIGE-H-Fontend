import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  DashboardApiError,
  ViewStateStatus,
} from '../../../core/models/executive-dashboard.model';

@Component({
  selector: 'app-ui-state-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <section
          class="state-panel state-panel--loading"
          role="status"
          aria-live="polite"
          data-testid="state-panel-loading"
        >
          <div class="state-panel__spinner" aria-hidden="true"></div>
          <h2 class="state-panel__title">Sincronizando Tablero Ejecutivo de Enfermería...</h2>
          <p class="state-panel__description">
            Consultando indicadores sintéticos de plantilla, asistencia, incidencias y cobertura por servicio.
          </p>
          <div class="state-panel__skeleton-grid" aria-hidden="true">
            <div class="state-panel__skeleton-box"></div>
            <div class="state-panel__skeleton-box"></div>
            <div class="state-panel__skeleton-box"></div>
            <div class="state-panel__skeleton-box"></div>
          </div>
        </section>
      }

      @case ('empty') {
        <section
          class="state-panel state-panel--empty"
          role="region"
          aria-label="Sin registros coincidentes"
          data-testid="state-panel-empty"
        >
          <div class="state-panel__badge state-panel__badge--neutral" aria-hidden="true">∅</div>
          <h2 class="state-panel__title">Sin registros operativos para los criterios seleccionados</h2>
          <p class="state-panel__description">
            No se encontraron servicios hospitalarios ni incidencias activas con el filtro de turno o búsqueda actual en el conjunto de demostración.
          </p>
          <div class="state-panel__actions">
            <button
              type="button"
              class="sigeh-btn sigeh-btn--primary"
              data-testid="btn-reset-filters"
              (click)="resetRequested.emit()"
            >
              Restablecer filtros del turno
            </button>
          </div>
        </section>
      }

      @case ('error') {
        <section
          class="state-panel state-panel--error"
          role="alert"
          data-testid="state-panel-error"
        >
          <div class="state-panel__badge state-panel__badge--error" aria-hidden="true">!</div>
          <h2 class="state-panel__title">
            {{ errorDetails()?.title || 'Error al cargar el corte ejecutivo' }}
          </h2>
          <p class="state-panel__description">
            {{
              errorDetails()?.message ||
                'Ocurrió una interrupción al recuperar los indicadores operativos. Intente actualizar la vista.'
            }}
          </p>
          @if (errorDetails()?.code) {
            <p class="state-panel__code">
              Código diagnóstico: <code>{{ errorDetails()?.code }}</code>
            </p>
          }
          <div class="state-panel__actions">
            <button
              type="button"
              class="sigeh-btn sigeh-btn--primary"
              data-testid="btn-retry-load"
              (click)="retryRequested.emit()"
            >
              Reintentar sincronización
            </button>
          </div>
        </section>
      }

      @case ('forbidden') {
        <section
          class="state-panel state-panel--forbidden"
          role="alert"
          data-testid="state-panel-forbidden"
        >
          <div class="state-panel__badge state-panel__badge--forbidden" aria-hidden="true">403</div>
          <h2 class="state-panel__title">
            {{ errorDetails()?.title || 'Acceso Restringido — Nivel de Supervisión Requerido' }}
          </h2>
          <p class="state-panel__description">
            {{
              errorDetails()?.message ||
                'Su sesión actual no cuenta con los privilegios necesarios para visualizar indicadores consolidados de jefatura.'
            }}
          </p>
          <p class="state-panel__code">
            Perfil requerido:
            <code>{{
              errorDetails()?.requiredRoleHint ||
                'ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION'
            }}</code>
          </p>
          <div class="state-panel__actions">
            <button
              type="button"
              class="sigeh-btn sigeh-btn--primary"
              data-testid="btn-restore-demo-access"
              (click)="restoreAccessRequested.emit()"
            >
              Restaurar vista con perfil Jefatura (Demo)
            </button>
          </div>
        </section>
      }
    }
  `,
  styles: `
    .state-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--sigeh-space-8) var(--sigeh-space-6);
      background-color: var(--sigeh-surface-card);
      border: 1px solid var(--sigeh-border-subtle);
      border-radius: var(--sigeh-radius-lg);
      box-shadow: var(--sigeh-shadow-sm);
      margin: var(--sigeh-space-4) 0;

      &--error {
        border-left: 5px solid var(--sigeh-status-critical-dot);
      }

      &--forbidden {
        border-left: 5px solid var(--sigeh-status-warning-dot);
      }
    }

    .state-panel__spinner {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 50%;
      border: 3px solid var(--sigeh-primary-100);
      border-top-color: var(--sigeh-primary-800);
      animation: sigeh-spin 0.85s linear infinite;
      margin-bottom: var(--sigeh-space-4);
    }

    @keyframes sigeh-spin {
      to {
        transform: rotate(360deg);
      }
    }

    .state-panel__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 3rem;
      height: 3rem;
      padding: 0 0.75rem;
      border-radius: var(--sigeh-radius-full);
      font-weight: 800;
      font-size: 1.1rem;
      margin-bottom: var(--sigeh-space-3);

      &--neutral {
        background-color: var(--sigeh-surface-bg);
        color: var(--sigeh-text-secondary);
      }

      &--error {
        background-color: var(--sigeh-status-critical-bg);
        color: var(--sigeh-status-critical-text);
      }

      &--forbidden {
        background-color: var(--sigeh-status-warning-bg);
        color: var(--sigeh-status-warning-text);
      }
    }

    .state-panel__title {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--sigeh-text-primary);
      margin-bottom: var(--sigeh-space-2);
    }

    .state-panel__description {
      max-width: 580px;
      font-size: 0.925rem;
      color: var(--sigeh-text-secondary);
      margin-bottom: var(--sigeh-space-4);
    }

    .state-panel__code {
      font-size: 0.8rem;
      color: var(--sigeh-text-muted);
      margin-bottom: var(--sigeh-space-4);

      code {
        font-family: var(--sigeh-font-mono);
        background-color: var(--sigeh-surface-bg);
        padding: 0.2rem 0.45rem;
        border-radius: var(--sigeh-radius-sm);
        color: var(--sigeh-primary-900);
      }
    }

    .state-panel__skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--sigeh-space-3);
      width: 100%;
      max-width: 820px;
      margin-top: var(--sigeh-space-2);
    }

    .state-panel__skeleton-box {
      height: 84px;
      border-radius: var(--sigeh-radius-md);
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
    }

    .state-panel__actions {
      display: flex;
      gap: var(--sigeh-space-3);
      flex-wrap: wrap;
      justify-content: center;
    }
  `,
})
export class UiStatePanelComponent {
  public readonly state = input.required<Exclude<ViewStateStatus, 'ready'>>();
  public readonly errorDetails = input<DashboardApiError | null>(null);

  public readonly retryRequested = output<void>();
  public readonly resetRequested = output<void>();
  public readonly restoreAccessRequested = output<void>();
}
