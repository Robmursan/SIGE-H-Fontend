import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataSourceMode } from '../../core/config/environment.config';
import { GatewaySelectorService } from '../../core/config/gateway-selector.service';
import {
  OperationalStatus,
  ViewStateStatus,
} from '../../core/models/executive-dashboard.model';
import { OrganizationQueryResult } from '../../core/models/organization.model';
import { ORGANIZATION_GATEWAY } from '../../core/ports/organization.gateway';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-organization-explorer',
  imports: [
    FormsModule,
    DemoModeBannerComponent,
    StatusBadgeComponent,
    UiStatePanelComponent,
  ],
  templateUrl: './organization-explorer.component.html',
  styleUrl: './organization-explorer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationExplorerComponent implements OnInit {
  private readonly gateway = inject(ORGANIZATION_GATEWAY);
  private readonly gatewaySelector = inject(GatewaySelectorService);

  protected readonly selectedHospitalId = signal<string>('HOSP-DEMO-01');
  protected readonly selectedDivisionId = signal<string | 'ALL'>('ALL');
  protected readonly searchQuery = signal<string>('');
  protected readonly statusFilter = signal<'ALL' | OperationalStatus>('ALL');
  protected readonly selectedServiceId = signal<string | undefined>(undefined);
  protected readonly simulatedState = signal<ViewStateStatus>('ready');

  protected readonly activeDataSourceMode = computed<DataSourceMode>(() =>
    this.gatewaySelector.resolveEffectiveMode('organization'),
  );

  protected readonly queryResult = signal<OrganizationQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly nonReadyState = computed<Exclude<ViewStateStatus, 'ready'>>(() => {
    const st = this.queryResult().state;
    return st === 'ready' ? 'loading' : st;
  });

  public ngOnInit(): void {
    this.refreshOrganization();
  }

  public setOrganizationDataSourceMode(mode: DataSourceMode): void {
    this.gatewaySelector.setModuleMode('organization', mode);
    this.simulatedState.set('ready');
    this.refreshOrganization();
  }

  public selectHospital(hospitalId: string): void {
    this.selectedHospitalId.set(hospitalId);
    this.selectedDivisionId.set('ALL');
    this.selectedServiceId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshOrganization();
  }

  public selectDivision(divisionId: string | 'ALL'): void {
    this.selectedDivisionId.set(divisionId);
    this.selectedServiceId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshOrganization();
  }

  public onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.simulatedState.set('ready');
    this.refreshOrganization();
  }

  public onStatusChange(status: 'ALL' | OperationalStatus): void {
    this.statusFilter.set(status);
    this.simulatedState.set('ready');
    this.refreshOrganization();
  }

  public selectService(serviceId: string): void {
    this.selectedServiceId.set(serviceId);
    this.refreshOrganization();
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshOrganization();
  }

  public resetFilters(): void {
    this.selectedDivisionId.set('ALL');
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.selectedServiceId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshOrganization();
  }

  public refreshOrganization(): void {
    this.gateway
      .queryOrganization({
        hospitalId: this.selectedHospitalId(),
        divisionId: this.selectedDivisionId(),
        searchQuery: this.searchQuery(),
        statusFilter: this.statusFilter(),
        selectedServiceId: this.selectedServiceId(),
        simulatedState: this.simulatedState(),
      })
      .subscribe((result) => {
        this.queryResult.set(result);
        const returnedHospId = result.snapshot?.selectedHospital.hospitalId;
        if (returnedHospId && returnedHospId !== this.selectedHospitalId()) {
          this.selectedHospitalId.set(returnedHospId);
        }
      });
  }
}
