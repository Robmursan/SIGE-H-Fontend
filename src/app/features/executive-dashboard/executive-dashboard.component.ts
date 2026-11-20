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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DataSourceMode } from '../../core/config/environment.config';
import { GatewaySelectorService } from '../../core/config/gateway-selector.service';
import {
  buildDefaultLocal168hWindow,
  buildLocalHoursWindow,
  validateProgrammingWindow168h,
} from '../../core/contracts/openapi-dtos.contract';
import {
  DashboardQueryResult,
  OperationalStatus,
  ShiftFilter,
  ViewStateStatus,
} from '../../core/models/executive-dashboard.model';
import { EXECUTIVE_DASHBOARD_GATEWAY } from '../../core/ports/executive-dashboard.gateway';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { EphemeralSessionTokenStore } from '../../core/security/ephemeral-session-token.store';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { KpiStatCardComponent } from '../../shared/components/kpi-stat-card/kpi-stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-executive-dashboard',
  imports: [
    FormsModule,
    RouterLink,
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
  private readonly gatewaySelector = inject(GatewaySelectorService);
  protected readonly authSession = inject(AuthSessionService);
  private readonly tokenStore = inject(EphemeralSessionTokenStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly cancelDashboard$ = new Subject<void>();
  private readonly initialWindow = buildDefaultLocal168hWindow();

  // Estado modo sintético (F1 — predeterminado)
  protected readonly selectedShift = signal<ShiftFilter>('ALL');
  protected readonly searchQuery = signal<string>('');
  protected readonly selectedStatus = signal<'ALL' | OperationalStatus>('ALL');
  protected readonly simulatedState = signal<ViewStateStatus>('ready');
  protected readonly highlightedSection = signal<string>('general');

  // Estado modo real OpenAPI v1 (F4-D — opt-in)
  protected readonly desdeIso = signal<string>(this.initialWindow.desde);
  protected readonly hastaIso = signal<string>(this.initialWindow.hasta);

  protected readonly queryResult = signal<DashboardQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly activeDataSourceMode = computed<DataSourceMode>(() =>
    this.gatewaySelector.resolveEffectiveMode('executive-dashboard'),
  );

  protected readonly isRealOpenApiMode = computed<boolean>(
    () => this.activeDataSourceMode() === 'OPENAPI_HTTP_READY',
  );

  protected readonly windowValidation = computed(() =>
    validateProgrammingWindow168h(this.desdeIso(), this.hastaIso()),
  );

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

  private lastContextKey: string | null = null;
  private initialized = false;

  public constructor() {
    const sub = this.tokenStore.sessionCleared$.subscribe(() => {
      if (this.isRealOpenApiMode()) {
        this.cancelDashboard$.next();
        this.queryResult.set({
          state: 'error',
          snapshot: null,
          error: {
            code: 'UNAUTHORIZED_SESSION',
            httpStatus: 401,
            title: 'Sesión IAM V2 Finalizada',
            message:
              'Se limpiaron los indicadores de coordinación tras cerrar sesión, revocación o cambio de usuario.',
            timestampIso: new Date().toISOString(),
          },
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.cancelDashboard$.next();
      this.cancelDashboard$.complete();
    });

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
          this.cancelDashboard$.next();
          this.refreshDashboard();
        });
      } else {
        this.lastContextKey = contextKey;
      }
    });
  }

  public ngOnInit(): void {
    this.initialized = true;
    this.route.queryParamMap.subscribe((params) => {
      const vista = params.get('vista');
      this.highlightedSection.set(vista ?? 'general');
    });
    this.refreshDashboard();
  }

  public setDashboardDataSourceMode(mode: DataSourceMode): void {
    this.cancelDashboard$.next();
    this.gatewaySelector.setModuleMode('executive-dashboard', mode);
    this.lastContextKey = this.buildCurrentContextKey();
    this.simulatedState.set('ready');
    this.refreshDashboard();
  }

  // --- Handlers Modo Sintético ---

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

  // --- Handlers Modo Real OpenAPI v1 (F4-D) ---

  public onAuthorizedHospitalChange(hospitalId: string): void {
    if (!this.authSession.selectHospital(hospitalId)) {
      return;
    }
    this.cancelDashboard$.next();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshDashboard();
  }

  public onAuthorizedServiceChange(servicioId: string): void {
    if (!this.authSession.selectService(servicioId)) {
      return;
    }
    this.cancelDashboard$.next();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshDashboard();
  }

  public onWindowRangeChange(desde: string, hasta: string): void {
    this.desdeIso.set(desde);
    this.hastaIso.set(hasta);
    this.cancelDashboard$.next();
    this.refreshDashboard();
  }

  public applyWindowPreset(hours: 24 | 168): void {
    const preset = buildLocalHoursWindow(hours);
    this.onWindowRangeChange(preset.desde, preset.hasta);
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshDashboard();
  }

  public resetFilters(): void {
    if (this.isRealOpenApiMode()) {
      const fresh = buildDefaultLocal168hWindow();
      this.desdeIso.set(fresh.desde);
      this.hastaIso.set(fresh.hasta);
      this.cancelDashboard$.next();
      this.refreshDashboard();
      return;
    }

    this.selectedShift.set('ALL');
    this.searchQuery.set('');
    this.selectedStatus.set('ALL');
    this.simulatedState.set('ready');
    this.refreshDashboard();
  }

  public refreshDashboard(): void {
    this.cancelDashboard$.next();

    if (this.isRealOpenApiMode()) {
      const ctx = this.authSession.selectedContext();
      this.queryResult.set({
        state: 'loading',
        snapshot: null,
        error: null,
      });

      this.gateway
        .queryDashboard({
          hospitalId: ctx?.hospitalId,
          divisionId: ctx?.divisionId ?? undefined,
          servicioId: ctx?.servicioId ?? undefined,
          desde: this.desdeIso(),
          hasta: this.hastaIso(),
        })
        .pipe(takeUntil(this.cancelDashboard$))
        .subscribe((result) => {
          this.queryResult.set(result);
        });
      return;
    }

    this.gateway
      .queryDashboard({
        shift: this.selectedShift(),
        serviceQuery: this.searchQuery(),
        statusFilter: this.selectedStatus(),
        simulatedState: this.simulatedState(),
      })
      .pipe(takeUntil(this.cancelDashboard$))
      .subscribe((result) => {
        this.queryResult.set(result);
      });
  }

  private buildCurrentContextKey(): string {
    return `${this.isRealOpenApiMode()}|${this.authSession.profile()?.usuarioId ?? ''}|${this.authSession.selectedHospitalId() ?? ''}|${this.authSession.selectedServiceId() ?? ''}`;
  }
}
