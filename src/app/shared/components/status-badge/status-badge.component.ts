import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IncidentSeverity, OperationalStatus } from '../../../core/models/executive-dashboard.model';

export type BadgeVariant = OperationalStatus | IncidentSeverity | 'info' | 'demo';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="variantClass()" [attr.aria-label]="label()">
      <span class="badge__dot" aria-hidden="true"></span>
      <span class="badge__text">{{ label() }}</span>
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.2rem 0.625rem;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.25;
      border-radius: var(--sigeh-radius-full);
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .badge__dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .badge--optimal,
    .badge--low {
      background-color: var(--sigeh-status-optimal-bg);
      color: var(--sigeh-status-optimal-text);
      border-color: var(--sigeh-status-optimal-border);
      .badge__dot {
        background-color: var(--sigeh-status-optimal-dot);
      }
    }

    .badge--warning,
    .badge--medium {
      background-color: var(--sigeh-status-warning-bg);
      color: var(--sigeh-status-warning-text);
      border-color: var(--sigeh-status-warning-border);
      .badge__dot {
        background-color: var(--sigeh-status-warning-dot);
      }
    }

    .badge--critical,
    .badge--high {
      background-color: var(--sigeh-status-critical-bg);
      color: var(--sigeh-status-critical-text);
      border-color: var(--sigeh-status-critical-border);
      .badge__dot {
        background-color: var(--sigeh-status-critical-dot);
      }
    }

    .badge--info {
      background-color: var(--sigeh-status-info-bg);
      color: var(--sigeh-status-info-text);
      border-color: var(--sigeh-status-info-border);
      .badge__dot {
        background-color: var(--sigeh-status-info-dot);
      }
    }

    .badge--demo {
      background-color: var(--sigeh-status-demo-bg);
      color: var(--sigeh-status-demo-text);
      border-color: var(--sigeh-status-demo-border);
      .badge__dot {
        background-color: var(--sigeh-status-demo-text);
      }
    }
  `,
})
export class StatusBadgeComponent {
  public readonly variant = input.required<BadgeVariant>();
  public readonly customLabel = input<string>('');

  protected readonly variantClass = computed(() => `badge--${this.variant()}`);

  protected readonly label = computed(() => {
    const custom = this.customLabel();
    if (custom.trim().length > 0) {
      return custom;
    }
    switch (this.variant()) {
      case 'optimal':
        return 'Óptimo';
      case 'warning':
        return 'Atención Preventiva';
      case 'critical':
        return 'Prioridad Crítica';
      case 'high':
        return 'Severidad Alta';
      case 'medium':
        return 'Severidad Media';
      case 'low':
        return 'Severidad Baja';
      case 'demo':
        return 'Datos Sintéticos Demo';
      default:
        return 'Informativo';
    }
  });
}
