import { InjectionToken } from '@angular/core';

export type DataSourceMode = 'SYNTHETIC_DEMO' | 'OPENAPI_HTTP_READY';

export type ModuleKey =
  | 'executive-dashboard'
  | 'organization'
  | 'personnel'
  | 'scheduling'
  | 'attendance-roster';

export interface SigehRuntimeConfig {
  readonly appVersion: string;
  readonly phase: 'F1' | 'F2' | 'F3-A' | 'F3-B' | 'F4-A' | 'F4-B' | 'F4-C' | 'F4-D' | 'F4-E1' | 'F4-F';
  readonly dataSourceMode: DataSourceMode;
  readonly isSyntheticDemo: boolean;
  readonly syntheticBannerLabel: string;
  /**
   * URL base del transporte HTTP OpenAPI:
   * - `''` (cadena vacía): origen actual (mismo origen), enrutado en desarrollo
   *   mediante `proxy.conf.json` (`/api` -> `http://127.0.0.1:3000`) sin habilitar CORS amplio.
   * - `null`: transporte HTTP explícitamente no configurado (`OPENAPI_NOT_CONFIGURED`).
   * - `'https://...'`: origen explícito para entornos controlados o pruebas.
   *
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
   * Controla si la autenticación IAM V2 y la protección de rutas están activas.
   * Permanece en `false` por defecto para conservar `SYNTHETIC_DEMO` accesible
   * sin iniciar sesión, y se activa explícitamente en pruebas o entornos QA autorizados.
   */
  readonly iamEnabled: boolean;
  readonly moduleDataSourceOverrides?: Partial<Record<ModuleKey, DataSourceMode>>;
  readonly enforceSyntheticFallbackWhenUnconfigured?: boolean;
}

export const DEFAULT_SIGEH_RUNTIME_CONFIG: SigehRuntimeConfig = {
  appVersion: '0.4.5-f4f',
  phase: 'F4-F',
  dataSourceMode: 'SYNTHETIC_DEMO',
  isSyntheticDemo: true,
  syntheticBannerLabel:
    'MODO DEMOSTRACIÓN SINTÉTICA (PREDETERMINADO F4-F) — CONSULTA DE PASES DE LISTA OPENAPI v1 LISTA (OPT-IN)',
  openApiBaseUrl: '',
  apiBasePath: '/api/v1',
  iamEnabled: false,
};

export const SIGEH_RUNTIME_CONFIG = new InjectionToken<SigehRuntimeConfig>('SIGEH_RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_SIGEH_RUNTIME_CONFIG,
});
