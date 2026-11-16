import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_SIGEH_RUNTIME_CONFIG,
  SIGEH_RUNTIME_CONFIG,
} from '../config/environment.config';
import { ExecutiveDashboardHttpService } from './executive-dashboard-http.service';

describe('ExecutiveDashboardHttpService (OpenAPI Ready Contract)', () => {
  it('should block HTTP traffic and return OPENAPI_NOT_CONFIGURED in F1 when openApiBaseUrl is null', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: { ...DEFAULT_SIGEH_RUNTIME_CONFIG, openApiBaseUrl: null },
        },
      ],
    });

    const service = TestBed.inject(ExecutiveDashboardHttpService);
    const httpMock = TestBed.inject(HttpTestingController);

    const result = await firstValueFrom(service.queryDashboard({ shift: 'Matutino' }));

    expect(result.state).toBe('error');
    expect(result.error?.code).toBe('OPENAPI_NOT_CONFIGURED');
    httpMock.verify();
  });

  it('should normalize HTTP 403 responses into forbidden ViewStateStatus when OpenAPI URL is provided', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: {
            ...DEFAULT_SIGEH_RUNTIME_CONFIG,
            openApiBaseUrl: 'https://openapi-demo.sigeh.internal/v1',
          },
        },
      ],
    });

    const service = TestBed.inject(ExecutiveDashboardHttpService);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = firstValueFrom(
      service.queryDashboard({ shift: 'Nocturno' }, '/executive-dashboard'),
    );

    const req = httpMock.expectOne(
      'https://openapi-demo.sigeh.internal/v1/executive-dashboard?shift=Nocturno',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-SIGEH-Client-Phase')).toBe('F3-B');

    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    const result = await promise;
    expect(result.state).toBe('forbidden');
    expect(result.error?.code).toBe('FORBIDDEN_ROLE');
    httpMock.verify();
  });
});
