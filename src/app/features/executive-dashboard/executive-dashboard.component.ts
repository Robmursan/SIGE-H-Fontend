import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  DashboardQueryResult,
  OperationalStatus,
  ShiftFilter,
  ViewStateStatus,
} from '../../core/models/executive-dashboard.model';
import { EXECUTIVE_DASHBOARD_GATEWAY } from '../../core/ports/executive-dashboard.gateway';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { KpiStatCardComponent } from '../../shared/components/kpi-stat-card/kpi-stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-executive-dashboard',
  imports: [
    FormsModule,
    DemoModeBannerComponent,
    KpiStatCardComponent,
    StatusBadgeComponent,
    UiStatePanelComponent,
  ],
  templateUrl: './executive-dashboard.component.html',
  styleUrl: './executive-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutiveDashboardComponent implements OnInit {
  private readonly gateway = inject(EXECUTIVE_DASHBOARD_GATEWAY);
  private readonly route = inject(ActivatedRoute);

  protected readonly selectedShift = signal<ShiftFilter>('ALL');
  protected readonly searchQuery = signal<string>('');
  protected readonly selectedStatus = signal<'ALL' | OperationalStatus>('ALL');
  protected readonly simulatedState = signal<ViewStateStatus>('ready');
  protected readonly highlightedSection = signal<string>('general');

  protected readonly queryResult = signal<DashboardQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly shiftOptions: ReadonlyArray<{ value: ShiftFilter; label: string }> = [
    { value: 'ALL', label: 'Todos los Turnos' },
    { value: 'Matutino', label: 'Matutino' },
    { value: 'Vespertino', label: 'Vespertino' },
    { value: 'Nocturno', label: 'Nocturno' },
  ];

  protected readonly nonReadyState = computed<Exclude<ViewStateStatus, 'ready'>>(() => {
    const current = this.queryResult().state;
    return current === 'ready' ? 'loading' : current;
  });

  public ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const vista = params.get('vista');
      this.highlightedSection.set(vista ?? 'general');
    });
    this.refreshDashboard();
  }

  public setShift(shift: ShiftFilter): void {
    this.selectedShift.set(shift);
    this.simulatedState.set('ready');
    this.refreshDashboard();
  }

  public onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.simulatedState.set('ready');
    this.refreshDashboard();
  }

  public onStatusFilterChange(status: 'ALL' | OperationalStatus): void {
    this.selectedStatus.set(status);
    this.simulatedState.set('ready');
    this.refreshDashboard();
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshDashboard();
  }

  public resetFilters(): void {
    this.selectedShift.set('ALL');
    this.searchQuery.set('');
    this.selectedStatus.set('ALL');
    this.simulatedState.set('ready');
    this.refreshDashboard();
  }

  public refreshDashboard(): void {
    this.gateway
      .queryDashboard({
        shift: this.selectedShift(),
        serviceQuery: this.searchQuery(),
        statusFilter: this.selectedStatus(),
        simulatedState: this.simulatedState(),
      })
      .subscribe((result) => {
        this.queryResult.set(result);
      });
  }
}
