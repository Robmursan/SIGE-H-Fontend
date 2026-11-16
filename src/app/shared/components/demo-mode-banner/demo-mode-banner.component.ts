import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ViewStateStatus } from '../../../core/models/executive-dashboard.model';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-demo-mode-banner',
  imports: [StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="demo-banner"
      aria-label="Aviso de modo demostración con datos sintéticos"
      data-testid="synthetic-demo-banner"
    >
      <div class="demo-banner__info">
        <app-status-badge variant="demo" customLabel="DEMOSTRACIÓN SINTÉTICA F1" />
        <p class="demo-banner__text">
          <strong>Origen de datos:</strong> Adaptador sintético determinista
          (<code>{{ datasetCode() }}</code>). Sin conexión al backend real ni datos clínicos reales.
        </p>
      </div>

      <div class="demo-banner__simulator" role="group" aria-label="Simulador de estados de interfaz">
        <span class="demo-banner__sim-label">Inspeccionar estado UI:</span>
        <div class="demo-banner__sim-buttons">
          @for (item of stateOptions; track item.value) {
            <button
              type="button"
              class="demo-banner__sim-btn"
              [class.demo-banner__sim-btn--active]="activeState() === item.value"
              [attr.data-testid]="'sim-state-' + item.value"
              [attr.aria-pressed]="activeState() === item.value"
              (click)="stateChange.emit(item.value)"
            >
              {{ item.label }}
            </button>
          }
        </div>
      </div>
    </aside>
  `,
  styles: `
    .demo-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--sigeh-space-3);
      padding: 0.75rem var(--sigeh-space-4);
      background-color: var(--sigeh-status-demo-bg);
      border: 1px solid var(--sigeh-status-demo-border);
      border-radius: var(--sigeh-radius-md);
      margin-bottom: var(--sigeh-space-5);
    }

    .demo-banner__info {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sigeh-space-3);
    }

    .demo-banner__text {
      font-size: 0.825rem;
      color: var(--sigeh-text-primary);

      code {
        font-family: var(--sigeh-font-mono);
        font-size: 0.775rem;
        background-color: rgba(255, 255, 255, 0.8);
        padding: 0.1rem 0.35rem;
        border-radius: var(--sigeh-radius-sm);
      }
    }

    .demo-banner__simulator {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sigeh-space-2);
    }

    .demo-banner__sim-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--sigeh-status-demo-text);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .demo-banner__sim-buttons {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .demo-banner__sim-btn {
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: var(--sigeh-radius-sm);
      border: 1px solid var(--sigeh-status-demo-border);
      background-color: #ffffff;
      color: var(--sigeh-text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background-color: var(--sigeh-primary-50);
        color: var(--sigeh-primary-900);
      }

      &--active {
        background-color: var(--sigeh-primary-900);
        color: #ffffff;
        border-color: var(--sigeh-primary-900);
      }
    }
  `,
})
export class DemoModeBannerComponent {
  public readonly datasetCode = input<string>('SIGEH-DEMO-F1-SYNTH-2026');
  public readonly activeState = input<ViewStateStatus>('ready');
  public readonly stateChange = output<ViewStateStatus>();

  protected readonly stateOptions: ReadonlyArray<{ value: ViewStateStatus; label: string }> = [
    { value: 'ready', label: 'Operativo (Datos)' },
    { value: 'loading', label: 'Cargando' },
    { value: 'empty', label: 'Vacío' },
    { value: 'error', label: 'Error' },
    { value: 'forbidden', label: 'Acceso Denegado' },
  ];
}
