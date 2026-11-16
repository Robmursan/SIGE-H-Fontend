import { InjectionToken } from '@angular/core';

export type DataSourceMode = 'SYNTHETIC_DEMO' | 'OPENAPI_HTTP_READY';

export type ModuleKey =
  | 'executive-dashboard'
  | 'organization'
  | 'personnel'
  | 'scheduling';

export interface SigehRuntimeConfig {
  readonly appVersion: string;
  readonly phase: 'F1' | 'F2' | 'F3-A' | 'F3-B';
  readonly dataSourceMode: DataSourceMode;
  readonly isSyntheticDemo: boolean;
  readonly syntheticBannerLabel: string;
  /**
   * URL base preparada para integración local con NestJS (`http://127.0.0.1:3000`).
   * El modo predeterminado continúa siendo `SYNTHETIC_DEMO` para garantizar que
   * la aplicación no emita tráfico HTTP no solicitado a menos que se conmute
   * explícitamente un módulo a `OPENAPI_HTTP_READY`.
   */
  readonly openApiBaseUrl: string | null;
  /**
   * Prefijo contractual verificado en `contracts/sigeh-v1.json`.
   */
  readonly apiBasePath: '/api/v1';
  /**
   * En F3-B la integración IAM se mantiene deshabilitada por instrucción expresa
   * hasta contar con autorización específica.
   */
  readonly iamEnabled: false;
  readonly moduleDataSourceOverrides?: Partial<Record<ModuleKey, DataSourceMode>>;
  readonly enforceSyntheticFallbackWhenUnconfigured?: boolean;
}

export const DEFAULT_SIGEH_RUNTIME_CONFIG: SigehRuntimeConfig = {
  appVersion: '0.3.0-f3b',
  phase: 'F3-B',
  dataSourceMode: 'SYNTHETIC_DEMO',
  isSyntheticDemo: true,
  syntheticBannerLabel:
    'MODO DEMOSTRACIÓN SINTÉTICA (PREDETERMINADO F3-B) — INTEGRACIÓN OPENAPI v1 LISTA PARA ORGANIZACIÓN',
  openApiBaseUrl: 'http://127.0.0.1:3000',
  apiBasePath: '/api/v1',
  iamEnabled: false,
};

export const SIGEH_RUNTIME_CONFIG = new InjectionToken<SigehRuntimeConfig>('SIGEH_RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_SIGEH_RUNTIME_CONFIG,
});
