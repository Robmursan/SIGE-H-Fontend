import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ShiftType,
  ViewStateStatus,
} from '../../core/models/executive-dashboard.model';
import { ScheduleSchemeType } from '../../core/models/personnel.model';
import { SchedulingQueryResult } from '../../core/models/scheduling.model';
import { SCHEDULING_GATEWAY } from '../../core/ports/scheduling.gateway';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-work-scheduling',
  imports: [
    FormsModule,
    DemoModeBannerComponent,
    StatusBadgeComponent,
    UiStatePanelComponent,
  ],
  templateUrl: './work-scheduling.component.html',
  styleUrl: './work-scheduling.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkSchedulingComponent implements OnInit {
  private readonly gateway = inject(SCHEDULING_GATEWAY);

  protected readonly selectedHospitalId = signal<string | 'ALL'>('ALL');
  protected readonly selectedServiceId = signal<string | 'ALL'>('ALL');
  protected readonly selectedShift = signal<'ALL' | ShiftType | 'Jornada Acumulada'>('ALL');
  protected readonly selectedScheme = signal<'ALL' | ScheduleSchemeType>('ALL');
  protected readonly searchQuery = signal<string>('');
  protected readonly simulatedState = signal<ViewStateStatus>('ready');

  protected readonly queryResult = signal<SchedulingQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly nonReadyState = computed<Exclude<ViewStateStatus, 'ready'>>(() => {
    const st = this.queryResult().state;
    return st === 'ready' ? 'loading' : st;
  });

  protected readonly filteredServicesOptions = computed(() => {
    const snap = this.queryResult().snapshot;
    if (!snap) {
      return [];
    }
    const hosp = this.selectedHospitalId();
    if (hosp === 'ALL') {
      return snap.availableServices;
    }
    return snap.availableServices.filter((s) => s.hospitalId === hosp);
  });

  public ngOnInit(): void {
    this.refreshSchedule();
  }

  public onHospitalChange(hospitalId: string | 'ALL'): void {
    this.selectedHospitalId.set(hospitalId);
    this.selectedServiceId.set('ALL');
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  public onServiceChange(serviceId: string | 'ALL'): void {
    this.selectedServiceId.set(serviceId);
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  public onShiftChange(shift: 'ALL' | ShiftType | 'Jornada Acumulada'): void {
    this.selectedShift.set(shift);
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  public onSchemeChange(scheme: 'ALL' | ScheduleSchemeType): void {
    this.selectedScheme.set(scheme);
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  public onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshSchedule();
  }

  public resetFilters(): void {
    this.selectedHospitalId.set('ALL');
    this.selectedServiceId.set('ALL');
    this.selectedShift.set('ALL');
    this.selectedScheme.set('ALL');
    this.searchQuery.set('');
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  public refreshSchedule(): void {
    this.gateway
      .queryWeeklySchedule({
        hospitalId: this.selectedHospitalId(),
        serviceId: this.selectedServiceId(),
        shiftFilter: this.selectedShift(),
        schemeFilter: this.selectedScheme(),
        searchQuery: this.searchQuery(),
        simulatedState: this.simulatedState(),
      })
      .subscribe((result) => {
        this.queryResult.set(result);
      });
  }
}
