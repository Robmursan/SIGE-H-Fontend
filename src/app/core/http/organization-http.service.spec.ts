import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  OrganizationReferencePageDto,
  UNAVAILABLE_V1_FIELD_LABEL,
} from '../contracts/openapi-dtos.contract';
import { OrganizationHttpService } from './organization-http.service';
import { SystemHealthHttpService } from './system-health-http.service';

const HOSP_UUID_1 = '11111111-1111-4111-8111-111111111111';
const DIV_UUID_1 = '22222222-2222-4222-8222-222222222222';
const SRV_UUID_1 = '33333333-3333-4333-8333-333333333333';
const SRV_UUID_2 = '44444444-4444-4444-8444-444444444444';

describe('OrganizationHttpService & SystemHealthHttpService (F3-B OpenAPI v1 Contract)', () => {
  let orgService: OrganizationHttpService;
  let healthService: SystemHealthHttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    orgService = TestBed.inject(OrganizationHttpService);
    healthService = TestBed.inject(SystemHealthHttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should consume GET /api/v1/hospitales, /divisiones and /servicios and map limited projection to domain with unavailable field states', async () => {
    const queryPromise = firstValueFrom(
      orgService.queryOrganization({
        hospitalId: HOSP_UUID_1,
        divisionId: DIV_UUID_1,
        limit: 50,
      }),
    );

    const hospReq = httpMock.expectOne(
      `/api/v1/hospitales?hospitalId=${HOSP_UUID_1}&limit=50`,
    );
    expect(hospReq.request.method).toBe('GET');

    const mockHospitalsPage: OrganizationReferencePageDto = {
      items: [
        {
          id: HOSP_UUID_1,
          hospitalId: HOSP_UUID_1,
          divisionId: null,
          servicioId: null,
          activo: true,
        },
      ],
      nextCursor: null,
      limit: 50,
      order: 'id:asc',
    };
    hospReq.flush(mockHospitalsPage);

    const divReq = httpMock.expectOne(
      `/api/v1/hospitales/${HOSP_UUID_1}/divisiones?divisionId=${DIV_UUID_1}&limit=50`,
    );
    expect(divReq.request.method).toBe('GET');

    const srvReq = httpMock.expectOne(
      `/api/v1/servicios?hospitalId=${HOSP_UUID_1}&divisionId=${DIV_UUID_1}&limit=50`,
    );
    expect(srvReq.request.method).toBe('GET');

    divReq.flush({
      items: [
        {
          id: DIV_UUID_1,
          hospitalId: HOSP_UUID_1,
          divisionId: DIV_UUID_1,
          servicioId: null,
          activo: true,
        },
      ],
      nextCursor: null,
      limit: 50,
      order: 'id:asc',
    } satisfies OrganizationReferencePageDto);

    srvReq.flush({
      items: [
        {
          id: SRV_UUID_1,
          hospitalId: HOSP_UUID_1,
          divisionId: DIV_UUID_1,
          servicioId: SRV_UUID_1,
          activo: true,
        },
        {
          id: SRV_UUID_2,
          hospitalId: HOSP_UUID_1,
          divisionId: DIV_UUID_1,
          servicioId: SRV_UUID_2,
          activo: false,
        },
      ],
      nextCursor: SRV_UUID_2,
      limit: 50,
      order: 'id:asc',
    } satisfies OrganizationReferencePageDto);

    const result = await queryPromise;

    expect(result.state).toBe('ready');
    expect(result.snapshot?.metadata.isSyntheticDemo).toBe(false);
    expect(result.snapshot?.projectionMode).toBe('OPENAPI_V1_IDENTIFIERS_ONLY');
    expect(result.snapshot?.cursorPagination?.nextCursor).toBe(SRV_UUID_2);
    expect(result.snapshot?.hospitals.length).toBe(1);
    expect(result.snapshot?.divisions.length).toBe(1);
    expect(result.snapshot?.services.length).toBe(2);

    const firstService = result.snapshot?.selectedService;
    expect(firstService?.serviceId).toBe(SRV_UUID_1);
    expect(firstService?.isLimitedProjection).toBe(true);
    expect(firstService?.physicalLocation).toBe(UNAVAILABLE_V1_FIELD_LABEL);
    expect(firstService?.authorizedPositions).toBeNull();
    expect(firstService?.activeStaffCount).toBeNull();
    expect(firstService?.enabledShifts).toEqual([]);
    expect(firstService?.responsibles).toEqual([]);
  });

  it('should handle HTTP 503 (IAM/ORG disabled by default) without granting client bypass', async () => {
    const queryPromise = firstValueFrom(orgService.queryOrganization({}));

    const hospReq = httpMock.expectOne('/api/v1/hospitales?limit=50');
    hospReq.flush(
      {
        statusCode: 503,
        message: 'Módulo ORG deshabilitado por defecto en esta instancia',
        error: 'Service Unavailable',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );

    const result = await queryPromise;
    expect(result.state).toBe('error');
    expect(result.snapshot).toBeNull();
    expect(result.error?.code).toBe('SERVICE_DISABLED_OR_UNAVAILABLE');
    expect(result.error?.httpStatus).toBe(503);
    expect(result.error?.message).toContain('Módulo ORG deshabilitado por defecto');
  });

  it('should handle HTTP 400 validation errors and HTTP 403 insufficient scope/faculty errors', async () => {
    const badReqPromise = firstValueFrom(orgService.queryOrganization({}));
    const req400 = httpMock.expectOne('/api/v1/hospitales?limit=50');
    req400.flush(
      {
        statusCode: 400,
        message: ['cursor must be a UUID'],
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const res400 = await badReqPromise;
    expect(res400.state).toBe('error');
    expect(res400.error?.code).toBe('BAD_REQUEST_VALIDATION');
    expect(res400.error?.message).toContain('cursor must be a UUID');

    const forbiddenPromise = firstValueFrom(orgService.queryOrganization({}));
    const req403 = httpMock.expectOne('/api/v1/hospitales?limit=50');
    req403.flush(
      {
        statusCode: 403,
        message: 'Se requiere facultad CATALOGOS_ADMINISTRAR en el alcance solicitado',
        error: 'Forbidden',
      },
      { status: 403, statusText: 'Forbidden' },
    );

    const res403 = await forbiddenPromise;
    expect(res403.state).toBe('forbidden');
    expect(res403.error?.code).toBe('FORBIDDEN_ROLE');
    expect(res403.error?.requiredRoleHint).toContain('CATALOGOS_ADMINISTRAR');
  });

  it('should consume /api/v1/health/live and /api/v1/meta/version', async () => {
    const livePromise = firstValueFrom(healthService.getHealthLive());
    const liveReq = httpMock.expectOne('/api/v1/health/live');
    liveReq.flush({
      status: 'ok',
      service: 'sige-h-api',
      timestamp: '2026-11-15T16:45:00.000Z',
    });
    const liveRes = await livePromise;
    expect(liveRes.status).toBe('ok');

    const verPromise = firstValueFrom(healthService.getApiContractVersion());
    const verReq = httpMock.expectOne('/api/v1/meta/version');
    verReq.flush({
      apiVersion: '1.0.0',
      apiBasePath: '/api/v1',
    });
    const verRes = await verPromise;
    expect(verRes.apiVersion).toBe('1.0.0');
    expect(verRes.apiBasePath).toBe('/api/v1');
  });
});
