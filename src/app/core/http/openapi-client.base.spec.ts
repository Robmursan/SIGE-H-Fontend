import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_SIGEH_RUNTIME_CONFIG,
  SIGEH_RUNTIME_CONFIG,
} from '../config/environment.config';
import { NormalizedHttpError, OpenApiClientBaseService } from './openapi-client.base';

describe('OpenApiClientBaseService (F4-A Same-Origin Proxy Configuration)', () => {
  it('should treat openApiBaseUrl = "" as configured same-origin transport and emit relative /api/v1 paths', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const client = TestBed.inject(OpenApiClientBaseService);
    const httpMock = TestBed.inject(HttpTestingController);

    expect(client.isConfigured()).toBe(true);

    const reqPromise = firstValueFrom(
      client.getTyped<{ apiVersion: string }>('/api/v1/meta/version'),
    );

    const req = httpMock.expectOne('/api/v1/meta/version');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.headers.get('X-SIGEH-Client-Phase')).toBe('F4-F');

    req.flush({ apiVersion: '1.0.0' });

    const res = await reqPromise;
    expect(res.apiVersion).toBe('1.0.0');
    httpMock.verify();
  });

  it('should treat openApiBaseUrl = null as unconfigured transport and reject with OPENAPI_NOT_CONFIGURED', async () => {
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
      ],
    });

    const client = TestBed.inject(OpenApiClientBaseService);
    const httpMock = TestBed.inject(HttpTestingController);

    expect(client.isConfigured()).toBe(false);

    let caught: NormalizedHttpError | null = null;
    try {
      await firstValueFrom(client.getTyped('/api/v1/meta/version'));
    } catch (err) {
      caught = err as NormalizedHttpError;
    }

    expect(caught).not.toBeNull();
    expect(caught?.code).toBe('OPENAPI_NOT_CONFIGURED');
    expect(caught?.status).toBe(0);
    httpMock.verify();
  });

  it('should trim trailing slash when an explicit openApiBaseUrl is configured', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: {
            ...DEFAULT_SIGEH_RUNTIME_CONFIG,
            openApiBaseUrl: 'https://sigeh.local/',
          },
        },
      ],
    });

    const client = TestBed.inject(OpenApiClientBaseService);
    const httpMock = TestBed.inject(HttpTestingController);

    expect(client.isConfigured()).toBe(true);

    const reqPromise = firstValueFrom(client.getTyped<{ status: string }>('/api/v1/health/live'));
    const req = httpMock.expectOne('https://sigeh.local/api/v1/health/live');
    req.flush({ status: 'ok' });

    const res = await reqPromise;
    expect(res.status).toBe('ok');
    httpMock.verify();
  });
});
