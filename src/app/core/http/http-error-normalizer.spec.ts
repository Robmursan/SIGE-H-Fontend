import { HttpErrorResponse } from '@angular/common/http';
import {
  mapNormalizedErrorToQueryFailure,
  normalizeOpenApiHttpError,
} from './http-error-normalizer';

describe('HTTP Error Normalizer (F3-A: 401, 403, 404, 409, 500)', () => {
  it('should normalize HTTP 401 into UNAUTHORIZED_SESSION error state', () => {
    const httpErr = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    const normalized = normalizeOpenApiHttpError(httpErr);
    const failure = mapNormalizedErrorToQueryFailure(normalized);

    expect(normalized.status).toBe(401);
    expect(normalized.code).toBe('UNAUTHORIZED_SESSION');
    expect(failure.state).toBe('error');
    expect(failure.error.httpStatus).toBe(401);
  });

  it('should normalize HTTP 403 into FORBIDDEN_ROLE and forbidden state', () => {
    const httpErr = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
    const normalized = normalizeOpenApiHttpError(httpErr);
    const failure = mapNormalizedErrorToQueryFailure(normalized);

    expect(normalized.status).toBe(403);
    expect(normalized.code).toBe('FORBIDDEN_ROLE');
    expect(failure.state).toBe('forbidden');
    expect(failure.error.requiredRoleHint).toContain('ROL_SUPERVISOR_ENFERMERIA');
  });

  it('should normalize HTTP 404 into RESOURCE_NOT_FOUND error state', () => {
    const httpErr = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    const normalized = normalizeOpenApiHttpError(httpErr);
    const failure = mapNormalizedErrorToQueryFailure(normalized);

    expect(normalized.status).toBe(404);
    expect(normalized.code).toBe('RESOURCE_NOT_FOUND');
    expect(failure.state).toBe('error');
  });

  it('should normalize HTTP 409 into CONFLICT_STATE error state', () => {
    const httpErr = new HttpErrorResponse({ status: 409, statusText: 'Conflict' });
    const normalized = normalizeOpenApiHttpError(httpErr);
    const failure = mapNormalizedErrorToQueryFailure(normalized);

    expect(normalized.status).toBe(409);
    expect(normalized.code).toBe('CONFLICT_STATE');
    expect(failure.state).toBe('error');
  });

  it('should normalize HTTP 500 into INTERNAL_SERVER_ERROR error state', () => {
    const httpErr = new HttpErrorResponse({
      status: 500,
      statusText: 'Internal Server Error',
    });
    const normalized = normalizeOpenApiHttpError(httpErr);
    const failure = mapNormalizedErrorToQueryFailure(normalized);

    expect(normalized.status).toBe(500);
    expect(normalized.code).toBe('INTERNAL_SERVER_ERROR');
    expect(failure.state).toBe('error');
  });

  it('should normalize HTTP 400, 429 and 503 according to contracts/sigeh-v1.json (F3-B)', () => {
    const err400 = normalizeOpenApiHttpError(
      new HttpErrorResponse({
        status: 400,
        error: { statusCode: 400, message: ['hospitalId must be a UUID'] },
      }),
    );
    expect(err400.code).toBe('BAD_REQUEST_VALIDATION');
    expect(err400.message).toContain('hospitalId must be a UUID');

    const err429 = normalizeOpenApiHttpError(
      new HttpErrorResponse({
        status: 429,
        statusText: 'Too Many Requests',
        error: {
          statusCode: 429,
          message: 'Demasiados intentos fallidos; espera antes de reintentar.',
        },
      }),
    );
    expect(err429.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err429.isIamRateLimitFormat).toBe(true);
    expect(err429.message).toContain('Demasiados intentos fallidos');

    const err503 = normalizeOpenApiHttpError(
      new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' }),
    );
    expect(err503.code).toBe('SERVICE_DISABLED_OR_UNAVAILABLE');
  });
});
