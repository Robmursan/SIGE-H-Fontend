import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { KpiMetric } from '../../../core/models/executive-dashboard.model';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-kpi-stat-card',
  imports: [StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="kpi-card"
      [class]="'kpi-card--' + metric().status"
      [attr.data-testid]="'kpi-card-' + metric().category"
    >
      <header class="kpi-card__header">
        <div class="kpi-card__category-tag">
          <span class="kpi-card__icon" aria-hidden="true">{{ categoryGlyph() }}</span>
          <span class="kpi-card__category-text">{{ categoryTitle() }}</span>
        </div>
        <app-status-badge [variant]="metric().status" />
      </header>

      <div class="kpi-card__body">
        <h3 class="kpi-card__label">{{ metric().label }}</h3>
        <div class="kpi-card__value-row">
          <span class="kpi-card__value">{{ metric().formattedValue }}</span>
          <span class="kpi-card__unit">{{ metric().unit }}</span>
        </div>
        <p class="kpi-card__summary">{{ metric().summary }}</p>
      </div>

      <div class="kpi-card__progress-wrap" role="presentation">
        <div class="kpi-card__progress-track">
          <div
            class="kpi-card__progress-bar"
            [style.width.%]="clampedPercentage()"
          ></div>
        </div>
      </div>

      <footer class="kpi-card__footer">
        <span class="kpi-card__target">{{ metric().targetLabel }}</span>
        <span class="kpi-card__delta">{{ metric().deltaLabel }}</span>
      </footer>
    </article>
  `,
  styles: `
    .kpi-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      height: 100%;
      gap: var(--sigeh-space-3);
      padding: var(--sigeh-space-4);
      background-color: var(--sigeh-surface-card);
      border: 1px solid var(--sigeh-border-subtle);
      border-top: 4px solid var(--sigeh-primary-700);
      border-radius: var(--sigeh-radius-lg);
      box-shadow: var(--sigeh-shadow-sm);
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        box-shadow: var(--sigeh-shadow-md);
      }

      &--optimal {
        border-top-color: var(--sigeh-status-optimal-dot);
        .kpi-card__progress-bar {
          background-color: var(--sigeh-status-optimal-dot);
        }
      }

      &--warning {
        border-top-color: var(--sigeh-status-warning-dot);
        .kpi-card__progress-bar {
          background-color: var(--sigeh-status-warning-dot);
        }
      }

      &--critical {
        border-top-color: var(--sigeh-status-critical-dot);
        .kpi-card__progress-bar {
          background-color: var(--sigeh-status-critical-dot);
        }
      }
    }

    .kpi-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--sigeh-space-2);
    }

    .kpi-card__category-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sigeh-text-muted);
    }

    .kpi-card__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: var(--sigeh-radius-sm);
      background-color: var(--sigeh-surface-subtle);
      color: var(--sigeh-primary-800);
      font-size: 0.85rem;
    }

    .kpi-card__label {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--sigeh-text-secondary);
      margin-bottom: 0.25rem;
    }

    .kpi-card__value-row {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .kpi-card__value {
      font-size: 1.75rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sigeh-text-primary);
    }

    .kpi-card__unit {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--sigeh-text-muted);
    }

    .kpi-card__summary {
      font-size: 0.8rem;
      color: var(--sigeh-text-muted);
      line-height: 1.4;
    }

    .kpi-card__progress-track {
      width: 100%;
      height: 6px;
      background-color: var(--sigeh-surface-bg);
      border-radius: var(--sigeh-radius-full);
      overflow: hidden;
    }

    .kpi-card__progress-bar {
      height: 100%;
      border-radius: var(--sigeh-radius-full);
      transition: width 0.3s ease;
    }

    .kpi-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding-top: var(--sigeh-space-2);
      border-top: 1px solid var(--sigeh-border-subtle);
      font-size: 0.75rem;
    }

    .kpi-card__target {
      color: var(--sigeh-text-muted);
      font-weight: 500;
    }

    .kpi-card__delta {
      color: var(--sigeh-text-secondary);
      font-weight: 600;
    }
  `,
})
export class KpiStatCardComponent {
  public readonly metric = input.required<KpiMetric>();

  protected readonly clampedPercentage = computed(() =>
    Math.max(0, Math.min(100, this.metric().compliancePercentage)),
  );

  protected readonly categoryTitle = computed(() => {
    switch (this.metric().category) {
      case 'personal':
        return 'Plantilla y Fuerza';
      case 'asistencia':
        return 'Asistencia';
      case 'incidencias':
        return 'Incidencias';
      case 'cobertura':
        return 'Cobertura Clínica';
    }
  });

  protected readonly categoryGlyph = computed(() => {
    switch (this.metric().category) {
      case 'personal':
        return '✚';
      case 'asistencia':
        return '✓';
      case 'incidencias':
        return '!';
      case 'cobertura':
        return '◈';
    }
  });
}
