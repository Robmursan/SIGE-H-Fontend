import { HttpErrorResponse } from '@angular/common/http';
import {
  DashboardApiError,
  DashboardApiErrorCode,
} from '../models/executive-dashboard.model';

export interface NormalizedHttpError {
  readonly status: number;
  readonly code: DashboardApiErrorCode;
  readonly title: string;
  readonly message: string;
  readonly requiredRoleHint?: string;
  readonly timestampIso: string;
}

/**
 * Normalizador uniforme de errores HTTP conforme a `contracts/CONTRATO-SIGE-H-v1.md`:
 * - 400: Entrada/filtros/cursor inválidos (`BAD_REQUEST_VALIDATION`)
 * - 401: Credencial/sesión inválida (`UNAUTHORIZED_SESSION`)
 * - 403: Facultad/ámbito insuficiente (`FORBIDDEN_ROLE` -> `CATALOGOS_ADMINISTRAR`)
 * - 404: Recurso o sesión no disponible (`RESOURCE_NOT_FOUND`)
 * - 409: Conflicto de integridad (`CONFLICT_STATE`)
 * - 429: Límite de intentos (`RATE_LIMIT_EXCEEDED`)
 * - 500/502/504: Fallo interno del servidor (`INTERNAL_SERVER_ERROR`)
 * - 503: IAM/ORG deshabilitado por defecto o persistencia PostgreSQL no disponible
 *        (`SERVICE_DISABLED_OR_UNAVAILABLE` — jamás se interpreta como permiso concedido).
 */
export function normalizeOpenApiHttpError(error: unknown): NormalizedHttpError {
  const timestampIso = new Date().toISOString();

  if (isAlreadyNormalizedHttpError(error)) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const nestMsg = extractNestErrorMessage(error.error);

    switch (error.status) {
      case 400:
        return {
          status: 400,
          code: 'BAD_REQUEST_VALIDATION',
          title: 'Solicitud Inválida o Parámetros Rechazados (HTTP 400)',
          message:
            nestMsg ??
            'Los filtros, identificadores UUID o el cursor de paginación son inválidos según el contrato v1.',
          timestampIso,
        };

      case 401:
        return {
          status: 401,
          code: 'UNAUTHORIZED_SESSION',
          title: 'Sesión No Autenticada o Expirada (HTTP 401)',
          message:
            nestMsg ??
            'Las credenciales de sesión no son válidas o han expirado. Se requiere token Bearer válido.',
          timestampIso,
        };

      case 403:
        return {
          status: 403,
          code: 'FORBIDDEN_ROLE',
          title: 'Acceso Denegado por Facultad o Alcance (HTTP 403)',
          message:
            nestMsg ??
            'La sesión no cuenta con la facultad explícita o el alcance hospitalario requerido para este recurso.',
          requiredRoleHint: 'CATALOGOS_ADMINISTRAR | ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION',
          timestampIso,
        };

      case 404:
        return {
          status: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Recurso o Sesión No Disponible (HTTP 404)',
          message:
            nestMsg ??
            'El hospital, división, servicio o sesión solicitada no existe o no está disponible para el actor.',
          timestampIso,
        };

      case 409:
        return {
          status: 409,
          code: 'CONFLICT_STATE',
          title: 'Conflicto de Integridad o Superposición Operativa (HTTP 409)',
          message:
            nestMsg ??
            'La operación presenta un conflicto de estado con el catálogo o la programación vigente.',
          timestampIso,
        };

      case 429:
        return {
          status: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          title: 'Límite de Solicitudes Excedido (HTTP 429)',
          message:
            nestMsg ??
            'Se alcanzó el límite persistente de intentos. Espere antes de reintentar la consulta.',
          timestampIso,
        };

      case 503:
        return {
          status: 503,
          code: 'SERVICE_DISABLED_OR_UNAVAILABLE',
          title: 'Módulo Deshabilitado por Defecto o Persistencia No Disponible (HTTP 503)',
          message:
            nestMsg ??
            'El módulo IAM/ORG se encuentra deshabilitado por defecto en el backend o PostgreSQL no está disponible. No se concede bypass en el cliente.',
          timestampIso,
        };

      case 500:
      case 502:
      case 504:
        return {
          status: error.status,
          code: 'INTERNAL_SERVER_ERROR',
          title: `Error Interno del Servicio Institucional (HTTP ${error.status})`,
          message:
            nestMsg ??
            'El servicio central experimentó un fallo interno al procesar la consulta.',
          timestampIso,
        };

      default:
        return {
          status: error.status,
          code: 'NETWORK_ERROR',
          title: 'Error de Comunicación con el Servidor OpenAPI',
          message:
            nestMsg ||
            error.message ||
            'No fue posible establecer comunicación con el servicio institucional.',
          timestampIso,
        };
    }
  }

  return {
    status: -1,
    code: 'NETWORK_ERROR',
    title: 'Error Inesperado de Transporte HTTP',
    message: 'Ocurrió un fallo inesperado al procesar la solicitud tipada.',
    timestampIso,
  };
}

export function mapNormalizedErrorToQueryFailure(
  err: NormalizedHttpError,
  defaultRoleHint = 'CATALOGOS_ADMINISTRAR | ROL_SUPERVISOR_ENFERMERIA | ROL_JEFATURA_DIVISION',
): {
  readonly state: 'error' | 'forbidden';
  readonly error: DashboardApiError;
} {
  const isForbidden = err.status === 403 || err.code === 'FORBIDDEN_ROLE';

  return {
    state: isForbidden ? 'forbidden' : 'error',
    error: {
      code: err.code,
      httpStatus: err.status,
      title: err.title,
      message: err.message,
      requiredRoleHint: isForbidden
        ? (err.requiredRoleHint ?? defaultRoleHint)
        : err.requiredRoleHint,
      timestampIso: err.timestampIso,
    },
  };
}

function extractNestErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const rec = payload as Record<string, unknown>;
  const msg = rec['message'];
  if (typeof msg === 'string' && msg.trim().length > 0) {
    return msg.trim();
  }
  if (Array.isArray(msg) && msg.length > 0) {
    return msg.map((item) => String(item)).join('; ');
  }
  return null;
}

function isAlreadyNormalizedHttpError(candidate: unknown): candidate is NormalizedHttpError {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const rec = candidate as Record<string, unknown>;
  return (
    typeof rec['status'] === 'number' &&
    typeof rec['code'] === 'string' &&
    typeof rec['title'] === 'string' &&
    typeof rec['message'] === 'string' &&
    typeof rec['timestampIso'] === 'string'
  );
}
