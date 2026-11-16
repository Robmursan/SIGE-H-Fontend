import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ViewStateStatus } from '../../core/models/executive-dashboard.model';
import {
  EmploymentStatus,
  NominalCategory,
  PersonnelQueryResult,
} from '../../core/models/personnel.model';
import { PERSONNEL_GATEWAY } from '../../core/ports/personnel.gateway';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { KpiStatCardComponent } from '../../shared/components/kpi-stat-card/kpi-stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-personnel-management',
  imports: [
    FormsModule,
    DemoModeBannerComponent,
    KpiStatCardComponent,
    StatusBadgeComponent,
    UiStatePanelComponent,
  ],
  templateUrl: './personnel-management.component.html',
  styleUrl: './personnel-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonnelManagementComponent implements OnInit {
  private readonly gateway = inject(PERSONNEL_GATEWAY);

  protected readonly selectedHospitalId = signal<string | 'ALL'>('ALL');
  protected readonly selectedServiceId = signal<string | 'ALL'>('ALL');
  protected readonly selectedCategory = signal<NominalCategory | 'ALL'>('ALL');
  protected readonly selectedStatus = signal<EmploymentStatus | 'ALL'>('ALL');
  protected readonly searchQuery = signal<string>('');
  protected readonly currentPage = signal<number>(1);
  protected readonly pageSize = signal<number>(5);
  protected readonly selectedEmployeeId = signal<string | undefined>(undefined);
  protected readonly simulatedState = signal<ViewStateStatus>('ready');

  protected readonly queryResult = signal<PersonnelQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly categories: readonly NominalCategory[] = [
    'Jefa(e) de Piso de Enfermería',
    'Enfermera(o) Especialista C',
    'Enfermera(o) General Titulada(o) B',
    'Auxiliar de Enfermería General A',
  ];

  protected readonly employmentStatuses: readonly EmploymentStatus[] = [
    'Activo en Servicio',
    'Incapacidad Temporal',
    'Licencia / Comisión',
    'Vacaciones Programadas',
  ];

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
    this.refreshPersonnel();
  }

  public onHospitalChange(hospitalId: string | 'ALL'): void {
    this.selectedHospitalId.set(hospitalId);
    this.selectedServiceId.set('ALL');
    this.currentPage.set(1);
    this.selectedEmployeeId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshPersonnel();
  }

  public onServiceChange(serviceId: string | 'ALL'): void {
    this.selectedServiceId.set(serviceId);
    this.currentPage.set(1);
    this.selectedEmployeeId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshPersonnel();
  }

  public onCategoryChange(cat: NominalCategory | 'ALL'): void {
    this.selectedCategory.set(cat);
    this.currentPage.set(1);
    this.selectedEmployeeId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshPersonnel();
  }

  public onStatusChange(status: EmploymentStatus | 'ALL'): void {
    this.selectedStatus.set(status);
    this.currentPage.set(1);
    this.selectedEmployeeId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshPersonnel();
  }

  public onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
    this.selectedEmployeeId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshPersonnel();
  }

  public goToPage(page: number): void {
    this.currentPage.set(page);
    this.refreshPersonnel();
  }

  public onPageSizeChange(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
    this.refreshPersonnel();
  }

  public selectEmployee(employeeId: string): void {
    this.selectedEmployeeId.set(employeeId);
    this.refreshPersonnel();
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshPersonnel();
  }

  public resetFilters(): void {
    this.selectedHospitalId.set('ALL');
    this.selectedServiceId.set('ALL');
    this.selectedCategory.set('ALL');
    this.selectedStatus.set('ALL');
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.selectedEmployeeId.set(undefined);
    this.simulatedState.set('ready');
    this.refreshPersonnel();
  }

  public refreshPersonnel(): void {
    this.gateway
      .queryPersonnel({
        hospitalId: this.selectedHospitalId(),
        serviceId: this.selectedServiceId(),
        nominalCategory: this.selectedCategory(),
        employmentStatus: this.selectedStatus(),
        searchQuery: this.searchQuery(),
        page: this.currentPage(),
        pageSize: this.pageSize(),
        selectedEmployeeId: this.selectedEmployeeId(),
        simulatedState: this.simulatedState(),
      })
      .subscribe((result) => {
        this.queryResult.set(result);
      });
  }
}
