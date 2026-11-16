import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ORGANIZATION_GATEWAY } from '../ports/organization.gateway';
import {
  DEFAULT_SIGEH_RUNTIME_CONFIG,
  SIGEH_RUNTIME_CONFIG,
} from './environment.config';
import {
  GatewaySelectorService,
  provideSigehConfigurableGateways,
} from './gateway-selector.service';

describe('GatewaySelectorService (F3-A / F3-B Configurable Synthetic vs OpenAPI HTTP)', () => {
  it('should keep SYNTHETIC_DEMO as default, prepare http://127.0.0.1:3000 as local base URL, and keep IAM disabled', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideSigehConfigurableGateways(),
      ],
    });

    const config = TestBed.inject(SIGEH_RUNTIME_CONFIG);
    const selector = TestBed.inject(GatewaySelectorService);
    const orgGateway = TestBed.inject(ORGANIZATION_GATEWAY);

    expect(config.dataSourceMode).toBe('SYNTHETIC_DEMO');
    expect(config.openApiBaseUrl).toBe('http://127.0.0.1:3000');
    expect(config.apiBasePath).toBe('/api/v1');
    expect(config.iamEnabled).toBe(false);
    expect(selector.effectiveGlobalMode()).toBe('SYNTHETIC_DEMO');
    expect(orgGateway.isSyntheticDemo).toBe(true);
  });

  it('should switch dynamically per module and return OPENAPI_NOT_CONFIGURED when openApiBaseUrl is null', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: {
            ...DEFAULT_SIGEH_RUNTIME_CONFIG,
            openApiBaseUrl: null,
          },
        },
        ...provideSigehConfigurableGateways(),
      ],
    });

    const selector = TestBed.inject(GatewaySelectorService);
    const orgGateway = TestBed.inject(ORGANIZATION_GATEWAY);

    selector.setModuleMode('organization', 'OPENAPI_HTTP_READY');
    expect(selector.resolveEffectiveMode('organization')).toBe('OPENAPI_HTTP_READY');
    expect(orgGateway.isSyntheticDemo).toBe(false);

    const unconfiguredRes = await firstValueFrom(orgGateway.queryOrganization({}));
    expect(unconfiguredRes.state).toBe('error');
    expect(unconfiguredRes.error?.code).toBe('OPENAPI_NOT_CONFIGURED');

    selector.resetToDefaultSafeDemoMode();
    expect(orgGateway.isSyntheticDemo).toBe(true);
  });

  it('should enforce safe fallback to SYNTHETIC_DEMO when enforceSyntheticFallbackWhenUnconfigured is true and openApiBaseUrl is null', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: {
            ...DEFAULT_SIGEH_RUNTIME_CONFIG,
            dataSourceMode: 'OPENAPI_HTTP_READY',
            openApiBaseUrl: null,
            enforceSyntheticFallbackWhenUnconfigured: true,
          },
        },
        ...provideSigehConfigurableGateways(),
      ],
    });

    const selector = TestBed.inject(GatewaySelectorService);
    expect(selector.resolveEffectiveMode('personnel')).toBe('SYNTHETIC_DEMO');
  });
});
