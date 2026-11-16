import { computed, inject, Injectable, Provider, signal } from '@angular/core';
import { SyntheticExecutiveDashboardAdapter } from '../adapters/synthetic-executive-dashboard.adapter';
import { SyntheticOrganizationAdapter } from '../adapters/synthetic-organization.adapter';
import { SyntheticPersonnelAdapter } from '../adapters/synthetic-personnel.adapter';
import { SyntheticSchedulingAdapter } from '../adapters/synthetic-scheduling.adapter';
import { ExecutiveDashboardHttpService } from '../http/executive-dashboard-http.service';
import { OrganizationHttpService } from '../http/organization-http.service';
import { PersonnelHttpService } from '../http/personnel-http.service';
import { SchedulingHttpService } from '../http/scheduling-http.service';
import {
  EXECUTIVE_DASHBOARD_GATEWAY,
  ExecutiveDashboardGateway,
} from '../ports/executive-dashboard.gateway';
import {
  ORGANIZATION_GATEWAY,
  OrganizationGateway,
} from '../ports/organization.gateway';
import {
  PERSONNEL_GATEWAY,
  PersonnelGateway,
} from '../ports/personnel.gateway';
import {
  SCHEDULING_GATEWAY,
  SchedulingGateway,
} from '../ports/scheduling.gateway';
import {
  DataSourceMode,
  ModuleKey,
  SIGEH_RUNTIME_CONFIG,
} from './environment.config';

/**
 * Selector configurable entre Adaptador Sintético (modo seguro de demostración)
 * y Servicio HTTP OpenAPI Real por módulo o globalmente (F3-A).
 */
@Injectable({ providedIn: 'root' })
export class GatewaySelectorService {
  private readonly runtimeConfig = inject(SIGEH_RUNTIME_CONFIG);

  private readonly globalModeOverride = signal<DataSourceMode | null>(null);
  private readonly moduleOverrides = signal<Partial<Record<ModuleKey, DataSourceMode>>>({});

  public readonly effectiveGlobalMode = computed<DataSourceMode>(
    () => this.globalModeOverride() ?? this.runtimeConfig.dataSourceMode,
  );

  public setGlobalMode(mode: DataSourceMode): void {
    this.globalModeOverride.set(mode);
  }

  public setModuleMode(moduleKey: ModuleKey, mode: DataSourceMode): void {
    this.moduleOverrides.update((prev) => ({ ...prev, [moduleKey]: mode }));
  }

  public resetToDefaultSafeDemoMode(): void {
    this.globalModeOverride.set('SYNTHETIC_DEMO');
    this.moduleOverrides.set({});
  }

  public resolveEffectiveMode(moduleKey: ModuleKey): DataSourceMode {
    const runtimeOverride = this.moduleOverrides()[moduleKey];
    const configOverride = this.runtimeConfig.moduleDataSourceOverrides?.[moduleKey];
    const requestedMode =
      runtimeOverride ?? configOverride ?? this.effectiveGlobalMode();

    if (
      requestedMode === 'OPENAPI_HTTP_READY' &&
      this.runtimeConfig.enforceSyntheticFallbackWhenUnconfigured &&
      !this.runtimeConfig.openApiBaseUrl
    ) {
      return 'SYNTHETIC_DEMO';
    }

    return requestedMode;
  }

  public selectGateway<TGateway>(
    moduleKey: ModuleKey,
    syntheticAdapter: TGateway,
    openApiHttpService: TGateway,
  ): TGateway {
    return this.resolveEffectiveMode(moduleKey) === 'OPENAPI_HTTP_READY'
      ? openApiHttpService
      : syntheticAdapter;
  }
}

/**
 * Proxies reactivos que delegan cada llamada al adaptador sintético o al
 * servicio HTTP tipado según la configuración activa en `GatewaySelectorService`.
 */
@Injectable({ providedIn: 'root' })
export class ConfigurableExecutiveDashboardGateway implements ExecutiveDashboardGateway {
  private readonly selector = inject(GatewaySelectorService);
  private readonly synthetic = inject(SyntheticExecutiveDashboardAdapter);
  private readonly http = inject(ExecutiveDashboardHttpService);

  public get adapterName(): string {
    return this.activeGateway().adapterName;
  }

  public get isSyntheticDemo(): boolean {
    return this.activeGateway().isSyntheticDemo;
  }

  public queryDashboard(
    ...args: Parameters<ExecutiveDashboardGateway['queryDashboard']>
  ): ReturnType<ExecutiveDashboardGateway['queryDashboard']> {
    return this.activeGateway().queryDashboard(...args);
  }

  private activeGateway(): ExecutiveDashboardGateway {
    return this.selector.selectGateway<ExecutiveDashboardGateway>(
      'executive-dashboard',
      this.synthetic,
      this.http,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ConfigurableOrganizationGateway implements OrganizationGateway {
  private readonly selector = inject(GatewaySelectorService);
  private readonly synthetic = inject(SyntheticOrganizationAdapter);
  private readonly http = inject(OrganizationHttpService);

  public get adapterName(): string {
    return this.activeGateway().adapterName;
  }

  public get isSyntheticDemo(): boolean {
    return this.activeGateway().isSyntheticDemo;
  }

  public queryOrganization(
    ...args: Parameters<OrganizationGateway['queryOrganization']>
  ): ReturnType<OrganizationGateway['queryOrganization']> {
    return this.activeGateway().queryOrganization(...args);
  }

  private activeGateway(): OrganizationGateway {
    return this.selector.selectGateway<OrganizationGateway>(
      'organization',
      this.synthetic,
      this.http,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ConfigurablePersonnelGateway implements PersonnelGateway {
  private readonly selector = inject(GatewaySelectorService);
  private readonly synthetic = inject(SyntheticPersonnelAdapter);
  private readonly http = inject(PersonnelHttpService);

  public get adapterName(): string {
    return this.activeGateway().adapterName;
  }

  public get isSyntheticDemo(): boolean {
    return this.activeGateway().isSyntheticDemo;
  }

  public queryPersonnel(
    ...args: Parameters<PersonnelGateway['queryPersonnel']>
  ): ReturnType<PersonnelGateway['queryPersonnel']> {
    return this.activeGateway().queryPersonnel(...args);
  }

  private activeGateway(): PersonnelGateway {
    return this.selector.selectGateway<PersonnelGateway>(
      'personnel',
      this.synthetic,
      this.http,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ConfigurableSchedulingGateway implements SchedulingGateway {
  private readonly selector = inject(GatewaySelectorService);
  private readonly synthetic = inject(SyntheticSchedulingAdapter);
  private readonly http = inject(SchedulingHttpService);

  public get adapterName(): string {
    return this.activeGateway().adapterName;
  }

  public get isSyntheticDemo(): boolean {
    return this.activeGateway().isSyntheticDemo;
  }

  public queryWeeklySchedule(
    ...args: Parameters<SchedulingGateway['queryWeeklySchedule']>
  ): ReturnType<SchedulingGateway['queryWeeklySchedule']> {
    return this.activeGateway().queryWeeklySchedule(...args);
  }

  private activeGateway(): SchedulingGateway {
    return this.selector.selectGateway<SchedulingGateway>(
      'scheduling',
      this.synthetic,
      this.http,
    );
  }
}

export function provideSigehConfigurableGateways(): Provider[] {
  return [
    {
      provide: EXECUTIVE_DASHBOARD_GATEWAY,
      useExisting: ConfigurableExecutiveDashboardGateway,
    },
    {
      provide: ORGANIZATION_GATEWAY,
      useExisting: ConfigurableOrganizationGateway,
    },
    {
      provide: PERSONNEL_GATEWAY,
      useExisting: ConfigurablePersonnelGateway,
    },
    {
      provide: SCHEDULING_GATEWAY,
      useExisting: ConfigurableSchedulingGateway,
    },
  ];
}
