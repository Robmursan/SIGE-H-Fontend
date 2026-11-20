import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DataSourceMode } from '../../core/config/environment.config';
import { GatewaySelectorService } from '../../core/config/gateway-selector.service';
import { ViewStateStatus } from '../../core/models/executive-dashboard.model';
import {
  ContractAssignmentsQueryResult,
  EmployeeDetailQueryResult,
  EmploymentStatus,
  NominalCategory,
  PersonnelQueryResult,
} from '../../core/models/personnel.model';
import { PERSONNEL_GATEWAY } from '../../core/ports/personnel.gateway';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { EphemeralSessionTokenStore } from '../../core/security/ephemeral-session-token.store';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { KpiStatCardComponent } from '../../shared/components/kpi-stat-card/kpi-stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-personnel-management',
  imports: [
    FormsModule,
    RouterLink,
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
  private readonly gatewaySelector = inject(GatewaySelectorService);
  protected readonly authSession = inject(AuthSessionService);
  private readonly tokenStore = inject(EphemeralSessionTokenStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly cancelStaff$ = new Subject<void>();
  private readonly cancelDetail$ = new Subject<void>();
  private readonly cancelAssignments$ = new Subject<void>();

  // Estado compartido / Modo Demostración Sintética (F2 — predeterminado)
  protected readonly selectedHospitalId = signal<string | 'ALL'>('ALL');
  protected readonly selectedServiceId = signal<string | 'ALL'>('ALL');
  protected readonly selectedCategory = signal<NominalCategory | 'ALL'>('ALL');
  protected readonly selectedStatus = signal<EmploymentStatus | 'ALL'>('ALL');
  protected readonly searchQuery = signal<string>('');
  protected readonly currentPage = signal<number>(1);
  protected readonly pageSize = signal<number>(5);
  protected readonly selectedEmployeeId = signal<string | undefined>(undefined);
  protected readonly simulatedState = signal<ViewStateStatus>('ready');

  // Estado contractual OpenAPI v1 (F4-C — opt-in)
  protected readonly effectiveDate = signal<string>(new Date().toISOString().slice(0, 10));
  protected readonly openApiLimit = signal<number>(25);
  protected readonly currentCursor = signal<string | undefined>(undefined);
  protected readonly cursorPageIndex = signal<number>(1);
  protected readonly selectedContratoId = signal<string | null>(null);
  protected readonly contractAssignmentsCursor = signal<string | undefined>(undefined);

  protected readonly queryResult = signal<PersonnelQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly employeeDetailResult = signal<EmployeeDetailQueryResult | null>(null);
  protected readonly contractAssignmentsResult = signal<ContractAssignmentsQueryResult | null>(
    null,
  );

  protected readonly activeDataSourceMode = computed<DataSourceMode>(() =>
    this.gatewaySelector.resolveEffectiveMode('personnel'),
  );

  protected readonly isRealOpenApiMode = computed<boolean>(
    () => this.activeDataSourceMode() === 'OPENAPI_HTTP_READY',
  );

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

  protected readonly detailNonReadyState = computed<Exclude<ViewStateStatus, 'ready'>>(() => {
    const st = this.employeeDetailResult()?.state ?? 'loading';
    return st === 'ready' ? 'loading' : st;
  });

  protected readonly assignmentsNonReadyState = computed<Exclude<ViewStateStatus, 'ready'>>(() => {
    const st = this.contractAssignmentsResult()?.state ?? 'loading';
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

  private lastContextKey: string | null = null;
  private initialized = false;

  public constructor() {
    // Limpieza inmediata al cerrar sesión, cambiar usuario o detectar revocación IAM
    const sub = this.tokenStore.sessionCleared$.subscribe(() => {
      if (this.isRealOpenApiMode()) {
        this.cancelAllPendingRequests();
        this.clearRealResultsAndPagination();
        this.queryResult.set({
          state: 'error',
          snapshot: null,
          error: {
            code: 'UNAUTHORIZED_SESSION',
            httpStatus: 401,
            title: 'Sesión IAM V2 Finalizada',
            message:
              'Se limpió el padrón y detalle de personal tras cerrar sesión o cambiar de usuario.',
            timestampIso: new Date().toISOString(),
          },
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.cancelAllPendingRequests();
      this.cancelStaff$.complete();
      this.cancelDetail$.complete();
      this.cancelAssignments$.complete();
    });

    // Reacción ante cambios de usuario, hospital o servicio autorizado en AuthSessionService
    effect(() => {
      const realMode = this.isRealOpenApiMode();
      const userId = this.authSession.profile()?.usuarioId ?? '';
      const hospId = this.authSession.selectedHospitalId() ?? '';
      const srvId = this.authSession.selectedServiceId() ?? '';
      const contextKey = `${realMode}|${userId}|${hospId}|${srvId}`;

      if (!this.initialized) {
        this.lastContextKey = contextKey;
        return;
      }

      if (realMode && contextKey !== this.lastContextKey) {
        this.lastContextKey = contextKey;
        untracked(() => {
          this.cancelAllPendingRequests();
          this.clearRealResultsAndPagination();
          this.refreshPersonnel();
        });
      } else {
        this.lastContextKey = contextKey;
      }
    });
  }

  public ngOnInit(): void {
    this.initialized = true;
    this.refreshPersonnel();
  }

  public setPersonnelDataSourceMode(mode: DataSourceMode): void {
    this.cancelAllPendingRequests();
    this.clearRealResultsAndPagination();
    this.gatewaySelector.setModuleMode('personnel', mode);
    this.lastContextKey = this.buildCurrentContextKey();
    this.simulatedState.set('ready');
    this.refreshPersonnel();
  }

  // --- Handlers Modo Sintético ---

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

  // --- Handlers Modo Real OpenAPI v1 (F4-C) ---

  public onAuthorizedHospitalChange(hospitalId: string): void {
    if (!this.authSession.selectHospital(hospitalId)) {
      return;
    }
    this.cancelAllPendingRequests();
    this.clearRealResultsAndPagination();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshPersonnel();
  }

  public onAuthorizedServiceChange(servicioId: string): void {
    if (!this.authSession.selectService(servicioId)) {
      return;
    }
    this.cancelAllPendingRequests();
    this.clearRealResultsAndPagination();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshPersonnel();
  }

  public onEffectiveDateChange(dateValue: string): void {
    this.effectiveDate.set(dateValue);
    this.cancelAllPendingRequests();
    this.clearRealResultsAndPagination();
    this.refreshPersonnel();
  }

  public onOpenApiLimitChange(limitValue: number): void {
    const parsed = Math.min(100, Math.max(1, Math.trunc(Number(limitValue) || 25)));
    this.openApiLimit.set(parsed);
    this.cancelAllPendingRequests();
    this.clearRealResultsAndPagination();
    this.refreshPersonnel();
  }

  public loadNextStaffCursorPage(): void {
    const nextCursor = this.queryResult().snapshot?.cursorPagination?.nextCursor;
    if (!nextCursor) {
      return;
    }
    this.cancelDetail$.next();
    this.cancelAssignments$.next();
    this.selectedEmployeeId.set(undefined);
    this.employeeDetailResult.set(null);
    this.contractAssignmentsResult.set(null);
    this.selectedContratoId.set(null);
    this.currentCursor.set(nextCursor);
    this.cursorPageIndex.update((n) => n + 1);
    this.refreshPersonnel();
  }

  public resetStaffCursorPagination(): void {
    this.cancelAllPendingRequests();
    this.clearRealResultsAndPagination();
    this.refreshPersonnel();
  }

  // --- Recorrido Padrón -> Detalle de Empleado -> Adscripciones por Contrato ---

  public selectEmployee(employeeId: string): void {
    this.selectedEmployeeId.set(employeeId);

    if (!this.isRealOpenApiMode()) {
      this.refreshPersonnel();
      return;
    }

    const ctx = this.authSession.selectedContext();
    if (!ctx?.hospitalId || !ctx.servicioId) {
      return;
    }

    this.cancelDetail$.next();
    this.cancelAssignments$.next();
    this.selectedContratoId.set(null);
    this.contractAssignmentsResult.set(null);
    this.contractAssignmentsCursor.set(undefined);

    this.employeeDetailResult.set({
      state: 'loading',
      detail: null,
      error: null,
    });

    this.gateway
      .getEmployeeDetail({
        empleadoId: employeeId,
        hospitalId: ctx.hospitalId,
        servicioId: ctx.servicioId,
        divisionId: ctx.divisionId ?? undefined,
        fecha: this.effectiveDate(),
        limit: this.openApiLimit(),
      })
      .pipe(takeUntil(this.cancelDetail$))
      .subscribe((detailResult) => {
        this.employeeDetailResult.set(detailResult);
      });
  }

  public loadContractAssignments(contratoId: string, cursor?: string): void {
    const ctx = this.authSession.selectedContext();
    if (!ctx?.hospitalId || !ctx.servicioId) {
      return;
    }

    this.cancelAssignments$.next();
    this.selectedContratoId.set(contratoId);
    this.contractAssignmentsCursor.set(cursor);

    this.contractAssignmentsResult.set({
      state: 'loading',
      contratoId,
      items: [],
      cursorPagination: null,
      error: null,
    });

    this.gateway
      .listContractAssignments({
        contratoId,
        hospitalId: ctx.hospitalId,
        servicioId: ctx.servicioId,
        divisionId: ctx.divisionId ?? undefined,
        fecha: this.effectiveDate(),
        cursor,
        limit: this.openApiLimit(),
      })
      .pipe(takeUntil(this.cancelAssignments$))
      .subscribe((assignmentsResult) => {
        this.contractAssignmentsResult.set(assignmentsResult);
      });
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshPersonnel();
  }

  public resetFilters(): void {
    if (this.isRealOpenApiMode()) {
      this.effectiveDate.set(new Date().toISOString().slice(0, 10));
      this.openApiLimit.set(25);
      this.cancelAllPendingRequests();
      this.clearRealResultsAndPagination();
      this.refreshPersonnel();
      return;
    }

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
    this.cancelStaff$.next();

    if (this.isRealOpenApiMode()) {
      const ctx = this.authSession.selectedContext();
      this.queryResult.set({
        state: 'loading',
        snapshot: null,
        error: null,
      });

      this.gateway
        .queryPersonnel({
          hospitalId: ctx?.hospitalId,
          divisionId: ctx?.divisionId ?? undefined,
          serviceId: ctx?.servicioId ?? undefined,
          fecha: this.effectiveDate(),
          cursor: this.currentCursor(),
          limit: this.openApiLimit(),
        })
        .pipe(takeUntil(this.cancelStaff$))
        .subscribe((result) => {
          this.queryResult.set(result);
          if (result.state !== 'ready') {
            this.employeeDetailResult.set(null);
            this.contractAssignmentsResult.set(null);
          }
        });
      return;
    }

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
      .pipe(takeUntil(this.cancelStaff$))
      .subscribe((result) => {
        this.queryResult.set(result);
      });
  }

  private cancelAllPendingRequests(): void {
    this.cancelStaff$.next();
    this.cancelDetail$.next();
    this.cancelAssignments$.next();
  }

  private clearRealResultsAndPagination(): void {
    this.currentCursor.set(undefined);
    this.cursorPageIndex.set(1);
    this.selectedEmployeeId.set(undefined);
    this.selectedContratoId.set(null);
    this.contractAssignmentsCursor.set(undefined);
    this.employeeDetailResult.set(null);
    this.contractAssignmentsResult.set(null);
  }

  private buildCurrentContextKey(): string {
    return `${this.isRealOpenApiMode()}|${this.authSession.profile()?.usuarioId ?? ''}|${this.authSession.selectedHospitalId() ?? ''}|${this.authSession.selectedServiceId() ?? ''}`;
  }
}
