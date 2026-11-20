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
import {
  buildDefaultLocal168hWindow,
  buildLocalHoursWindow,
  validateProgrammingWindow168h,
} from '../../core/contracts/openapi-dtos.contract';
import {
  ShiftType,
  ViewStateStatus,
} from '../../core/models/executive-dashboard.model';
import { ScheduleSchemeType } from '../../core/models/personnel.model';
import { ScheduleEstado, SchedulingQueryResult } from '../../core/models/scheduling.model';
import { SCHEDULING_GATEWAY } from '../../core/ports/scheduling.gateway';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { EphemeralSessionTokenStore } from '../../core/security/ephemeral-session-token.store';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-work-scheduling',
  imports: [
    FormsModule,
    RouterLink,
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
  private readonly gatewaySelector = inject(GatewaySelectorService);
  protected readonly authSession = inject(AuthSessionService);
  private readonly tokenStore = inject(EphemeralSessionTokenStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly cancelSchedule$ = new Subject<void>();
  private readonly initialWindow = buildDefaultLocal168hWindow();

  // Estado modo sintético (F2 — predeterminado)
  protected readonly selectedHospitalId = signal<string | 'ALL'>('ALL');
  protected readonly selectedServiceId = signal<string | 'ALL'>('ALL');
  protected readonly selectedShift = signal<'ALL' | ShiftType | 'Jornada Acumulada'>('ALL');
  protected readonly selectedScheme = signal<'ALL' | ScheduleSchemeType>('ALL');
  protected readonly searchQuery = signal<string>('');
  protected readonly simulatedState = signal<ViewStateStatus>('ready');

  // Estado modo real OpenAPI v1 (F4-D — opt-in)
  protected readonly desdeIso = signal<string>(this.initialWindow.desde);
  protected readonly hastaIso = signal<string>(this.initialWindow.hasta);
  protected readonly openApiLimit = signal<number>(50);
  protected readonly currentCursor = signal<string | undefined>(undefined);
  protected readonly cursorPageIndex = signal<number>(1);

  protected readonly queryResult = signal<SchedulingQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly activeDataSourceMode = computed<DataSourceMode>(() =>
    this.gatewaySelector.resolveEffectiveMode('scheduling'),
  );

  protected readonly isRealOpenApiMode = computed<boolean>(
    () => this.activeDataSourceMode() === 'OPENAPI_HTTP_READY',
  );

  protected readonly windowValidation = computed(() =>
    validateProgrammingWindow168h(this.desdeIso(), this.hastaIso()),
  );

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

  private lastContextKey: string | null = null;
  private initialized = false;

  public constructor() {
    const sub = this.tokenStore.sessionCleared$.subscribe(() => {
      if (this.isRealOpenApiMode()) {
        this.cancelSchedule$.next();
        this.resetCursorState();
        this.queryResult.set({
          state: 'error',
          snapshot: null,
          error: {
            code: 'UNAUTHORIZED_SESSION',
            httpStatus: 401,
            title: 'Sesión IAM V2 Finalizada',
            message:
              'Se limpió la programación consultada tras cerrar sesión, revocación o cambio de usuario.',
            timestampIso: new Date().toISOString(),
          },
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.cancelSchedule$.next();
      this.cancelSchedule$.complete();
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
          this.cancelSchedule$.next();
          this.resetCursorState();
          this.refreshSchedule();
        });
      } else {
        this.lastContextKey = contextKey;
      }
    });
  }

  public ngOnInit(): void {
    this.initialized = true;
    this.refreshSchedule();
  }

  public setSchedulingDataSourceMode(mode: DataSourceMode): void {
    this.cancelSchedule$.next();
    this.resetCursorState();
    this.gatewaySelector.setModuleMode('scheduling', mode);
    this.lastContextKey = this.buildCurrentContextKey();
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  // --- Handlers Modo Sintético ---

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

  // --- Handlers Modo Real OpenAPI v1 (F4-D) ---

  public onAuthorizedHospitalChange(hospitalId: string): void {
    if (!this.authSession.selectHospital(hospitalId)) {
      return;
    }
    this.cancelSchedule$.next();
    this.resetCursorState();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshSchedule();
  }

  public onAuthorizedServiceChange(servicioId: string): void {
    if (!this.authSession.selectService(servicioId)) {
      return;
    }
    this.cancelSchedule$.next();
    this.resetCursorState();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshSchedule();
  }

  public onWindowRangeChange(desde: string, hasta: string): void {
    this.desdeIso.set(desde);
    this.hastaIso.set(hasta);
    this.cancelSchedule$.next();
    this.resetCursorState();
    this.refreshSchedule();
  }

  public applyWindowPreset(hours: 24 | 168): void {
    const preset = buildLocalHoursWindow(hours);
    this.onWindowRangeChange(preset.desde, preset.hasta);
  }

  public onOpenApiLimitChange(limitValue: number): void {
    const parsed = Math.min(100, Math.max(1, Math.trunc(Number(limitValue) || 50)));
    this.openApiLimit.set(parsed);
    this.cancelSchedule$.next();
    this.resetCursorState();
    this.refreshSchedule();
  }

  public loadNextCursorPage(): void {
    const nextCursor = this.queryResult().snapshot?.cursorPagination?.nextCursor;
    if (!nextCursor) {
      return;
    }
    this.cancelSchedule$.next();
    this.currentCursor.set(nextCursor);
    this.cursorPageIndex.update((n) => n + 1);
    this.refreshSchedule();
  }

  public resetCursorPagination(): void {
    this.cancelSchedule$.next();
    this.resetCursorState();
    this.refreshSchedule();
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshSchedule();
  }

  public resetFilters(): void {
    if (this.isRealOpenApiMode()) {
      const fresh = buildDefaultLocal168hWindow();
      this.desdeIso.set(fresh.desde);
      this.hastaIso.set(fresh.hasta);
      this.openApiLimit.set(50);
      this.cancelSchedule$.next();
      this.resetCursorState();
      this.refreshSchedule();
      return;
    }

    this.selectedHospitalId.set('ALL');
    this.selectedServiceId.set('ALL');
    this.selectedShift.set('ALL');
    this.selectedScheme.set('ALL');
    this.searchQuery.set('');
    this.simulatedState.set('ready');
    this.refreshSchedule();
  }

  public mapEstadoToVariant(estado: ScheduleEstado): 'optimal' | 'warning' | 'critical' | 'info' {
    switch (estado) {
      case 'PROGRAMADA':
        return 'optimal';
      case 'SUSTITUIDA':
        return 'warning';
      case 'CANCELADA':
        return 'critical';
      case 'CERRADA':
      default:
        return 'info';
    }
  }

  public refreshSchedule(): void {
    this.cancelSchedule$.next();

    if (this.isRealOpenApiMode()) {
      const ctx = this.authSession.selectedContext();
      this.queryResult.set({
        state: 'loading',
        snapshot: null,
        error: null,
      });

      this.gateway
        .queryWeeklySchedule({
          hospitalId: ctx?.hospitalId,
          divisionId: ctx?.divisionId ?? undefined,
          serviceId: ctx?.servicioId ?? undefined,
          desde: this.desdeIso(),
          hasta: this.hastaIso(),
          cursor: this.currentCursor(),
          limit: this.openApiLimit(),
        })
        .pipe(takeUntil(this.cancelSchedule$))
        .subscribe((result) => {
          this.queryResult.set(result);
        });
      return;
    }

    this.gateway
      .queryWeeklySchedule({
        hospitalId: this.selectedHospitalId(),
        serviceId: this.selectedServiceId(),
        shiftFilter: this.selectedShift(),
        schemeFilter: this.selectedScheme(),
        searchQuery: this.searchQuery(),
        simulatedState: this.simulatedState(),
      })
      .pipe(takeUntil(this.cancelSchedule$))
      .subscribe((result) => {
        this.queryResult.set(result);
      });
  }

  private resetCursorState(): void {
    this.currentCursor.set(undefined);
    this.cursorPageIndex.set(1);
  }

  private buildCurrentContextKey(): string {
    return `${this.isRealOpenApiMode()}|${this.authSession.profile()?.usuarioId ?? ''}|${this.authSession.selectedHospitalId() ?? ''}|${this.authSession.selectedServiceId() ?? ''}`;
  }
}
