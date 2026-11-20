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
  AttendanceOperationalState,
  AttendanceRosterQueryResult,
} from '../../core/models/attendance-roster.model';
import { ViewStateStatus } from '../../core/models/executive-dashboard.model';
import { ATTENDANCE_ROSTER_GATEWAY } from '../../core/ports/attendance-roster.gateway';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { EphemeralSessionTokenStore } from '../../core/security/ephemeral-session-token.store';
import { DemoModeBannerComponent } from '../../shared/components/demo-mode-banner/demo-mode-banner.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UiStatePanelComponent } from '../../shared/components/ui-state-panel/ui-state-panel.component';

@Component({
  selector: 'app-attendance-roster',
  imports: [
    FormsModule,
    RouterLink,
    DemoModeBannerComponent,
    StatusBadgeComponent,
    UiStatePanelComponent,
  ],
  templateUrl: './attendance-roster.component.html',
  styleUrl: './attendance-roster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceRosterComponent implements OnInit {
  private readonly gateway = inject(ATTENDANCE_ROSTER_GATEWAY);
  private readonly gatewaySelector = inject(GatewaySelectorService);
  protected readonly authSession = inject(AuthSessionService);
  private readonly tokenStore = inject(EphemeralSessionTokenStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly cancelRoster$ = new Subject<void>();

  protected readonly fechaLocal = signal<string>(new Date().toISOString().slice(0, 10));
  protected readonly horarioIdFilter = signal<string>('');
  protected readonly estadoFilter = signal<'ALL' | AttendanceOperationalState>('ALL');
  protected readonly openApiLimit = signal<number>(50);
  protected readonly currentCursor = signal<string | undefined>(undefined);
  protected readonly cursorPageIndex = signal<number>(1);
  protected readonly simulatedState = signal<ViewStateStatus>('ready');

  protected readonly queryResult = signal<AttendanceRosterQueryResult>({
    state: 'loading',
    snapshot: null,
    error: null,
  });

  protected readonly activeDataSourceMode = computed<DataSourceMode>(() =>
    this.gatewaySelector.resolveEffectiveMode('attendance-roster'),
  );

  protected readonly isRealOpenApiMode = computed<boolean>(
    () => this.activeDataSourceMode() === 'OPENAPI_HTTP_READY',
  );

  protected readonly nonReadyState = computed<Exclude<ViewStateStatus, 'ready'>>(() => {
    const st = this.queryResult().state;
    return st === 'ready' ? 'loading' : st;
  });

  /** Conteos informativos estrictamente sobre los registros visibles de la página actual */
  protected readonly pageOperationalCounts = computed(() => {
    const items = this.queryResult().snapshot?.items ?? [];
    return {
      presente: items.filter((i) => i.estadoOperativo === 'PRESENTE').length,
      parcial: items.filter((i) => i.estadoOperativo === 'PARCIAL').length,
      ausente: items.filter((i) => i.estadoOperativo === 'AUSENTE').length,
      pendiente: items.filter((i) => i.estadoOperativo === 'PENDIENTE').length,
      noExigible: items.filter((i) => i.estadoOperativo === 'NO_EXIGIBLE').length,
    };
  });

  private lastContextKey: string | null = null;
  private initialized = false;

  public constructor() {
    const sub = this.tokenStore.sessionCleared$.subscribe(() => {
      if (this.isRealOpenApiMode()) {
        this.cancelRoster$.next();
        this.resetCursorState();
        this.queryResult.set({
          state: 'error',
          snapshot: null,
          error: {
            code: 'UNAUTHORIZED_SESSION',
            httpStatus: 401,
            title: 'Sesión IAM V2 Finalizada',
            message:
              'Se limpió la consulta de pases de lista tras cerrar sesión, revocación o cambio de usuario.',
            timestampIso: new Date().toISOString(),
          },
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.cancelRoster$.next();
      this.cancelRoster$.complete();
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
          this.cancelRoster$.next();
          this.resetCursorState();
          this.refreshRoster();
        });
      } else {
        this.lastContextKey = contextKey;
      }
    });
  }

  public ngOnInit(): void {
    this.initialized = true;
    this.refreshRoster();
  }

  public setRosterDataSourceMode(mode: DataSourceMode): void {
    this.cancelRoster$.next();
    this.resetCursorState();
    this.gatewaySelector.setModuleMode('attendance-roster', mode);
    this.lastContextKey = this.buildCurrentContextKey();
    this.simulatedState.set('ready');
    this.refreshRoster();
  }

  public onAuthorizedHospitalChange(hospitalId: string): void {
    if (!this.authSession.selectHospital(hospitalId)) {
      return;
    }
    this.cancelRoster$.next();
    this.resetCursorState();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshRoster();
  }

  public onAuthorizedServiceChange(servicioId: string): void {
    if (!this.authSession.selectService(servicioId)) {
      return;
    }
    this.cancelRoster$.next();
    this.resetCursorState();
    this.lastContextKey = this.buildCurrentContextKey();
    this.refreshRoster();
  }

  public onFechaChange(fecha: string): void {
    this.fechaLocal.set(fecha);
    this.cancelRoster$.next();
    this.resetCursorState();
    this.refreshRoster();
  }

  public onHorarioIdChange(horarioId: string): void {
    this.horarioIdFilter.set(horarioId);
    this.cancelRoster$.next();
    this.resetCursorState();
    this.refreshRoster();
  }

  public onEstadoFilterChange(estado: 'ALL' | AttendanceOperationalState): void {
    this.estadoFilter.set(estado);
    this.cancelRoster$.next();
    this.resetCursorState();
    this.refreshRoster();
  }

  public onLimitChange(limitValue: number): void {
    const parsed = Math.min(100, Math.max(1, Math.trunc(Number(limitValue) || 50)));
    this.openApiLimit.set(parsed);
    this.cancelRoster$.next();
    this.resetCursorState();
    this.refreshRoster();
  }

  public loadNextCursorPage(): void {
    const nextCursor = this.queryResult().snapshot?.cursorPagination.nextCursor;
    if (!nextCursor) {
      return;
    }
    this.cancelRoster$.next();
    this.currentCursor.set(nextCursor);
    this.cursorPageIndex.update((n) => n + 1);
    this.refreshRoster();
  }

  public resetCursorPagination(): void {
    this.cancelRoster$.next();
    this.resetCursorState();
    this.refreshRoster();
  }

  public setSimulatedState(state: ViewStateStatus): void {
    this.simulatedState.set(state);
    this.refreshRoster();
  }

  public resetFilters(): void {
    this.fechaLocal.set(new Date().toISOString().slice(0, 10));
    this.horarioIdFilter.set('');
    this.estadoFilter.set('ALL');
    this.openApiLimit.set(50);
    this.simulatedState.set('ready');
    this.cancelRoster$.next();
    this.resetCursorState();
    this.refreshRoster();
  }

  public mapEstadoOperativoToVariant(
    estado: AttendanceOperationalState,
  ): 'optimal' | 'warning' | 'critical' | 'info' {
    switch (estado) {
      case 'PRESENTE':
        return 'optimal';
      case 'PARCIAL':
        return 'warning';
      case 'AUSENTE':
        return 'critical';
      case 'PENDIENTE':
      case 'NO_EXIGIBLE':
      default:
        return 'info';
    }
  }

  public refreshRoster(): void {
    this.cancelRoster$.next();

    if (this.isRealOpenApiMode()) {
      const ctx = this.authSession.selectedContext();
      this.queryResult.set({
        state: 'loading',
        snapshot: null,
        error: null,
      });

      this.gateway
        .queryAttendanceRoster({
          hospitalId: ctx?.hospitalId,
          servicioId: ctx?.servicioId ?? undefined,
          fecha: this.fechaLocal(),
          horarioId: this.horarioIdFilter().trim() || undefined,
          cursor: this.currentCursor(),
          limit: this.openApiLimit(),
          estadoFilter: this.estadoFilter(),
        })
        .pipe(takeUntil(this.cancelRoster$))
        .subscribe((res) => {
          this.queryResult.set(res);
        });
      return;
    }

    this.gateway
      .queryAttendanceRoster({
        fecha: this.fechaLocal(),
        estadoFilter: this.estadoFilter(),
        limit: this.openApiLimit(),
        simulatedState: this.simulatedState(),
      })
      .pipe(takeUntil(this.cancelRoster$))
      .subscribe((res) => {
        this.queryResult.set(res);
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
