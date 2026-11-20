import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { SIGEH_RUNTIME_CONFIG } from '../config/environment.config';
import {
  AssignmentKind,
  LoginDto,
  ProfileDto,
  SessionDto,
} from '../contracts/openapi-dtos.contract';
import { AuthHttpService } from '../http/auth-http.service';
import { NormalizedHttpError } from '../http/http-error-normalizer';
import {
  EphemeralSessionStatus,
  EphemeralSessionTokenStore,
} from './ephemeral-session-token.store';

export interface AuthorizedServiceOption {
  readonly hospitalId: string;
  readonly divisionId: string | null;
  readonly servicioId: string;
  readonly displayLabel: string;
  readonly kinds: readonly Exclude<AssignmentKind, null>[];
  readonly permissions: readonly string[];
}

export interface AuthorizedHospitalOption {
  readonly hospitalId: string;
  readonly displayLabel: string;
  readonly divisionIds: readonly string[];
  readonly explicitServices: readonly AuthorizedServiceOption[];
  readonly hasBroadScopeWithoutExplicitServices: boolean;
  readonly permissions: readonly string[];
}

export interface SelectedAuthorizedContext {
  readonly hospitalId: string;
  readonly divisionId: string | null;
  readonly servicioId: string | null;
  readonly permissions: readonly string[];
  readonly isServiceExplicitlyAuthorized: boolean;
  readonly hasBroadScopeWithoutServiceEnumeration: boolean;
}

export interface ScopeLimitationNotice {
  readonly code:
    | 'NO_AUTHORIZED_ASSIGNMENTS'
    | 'SERVICE_ENUMERATION_UNAVAILABLE_WITHOUT_CATALOG'
    | 'DESCRIPTIVE_NAMES_UNAVAILABLE_V1';
  readonly message: string;
}

/**
 * Deriva hospitales y servicios exclusivamente desde `ProfileDto.assignments` (`/auth/me`).
 * Nunca inventa nombres descriptivos, nunca enumera servicios no presentes en las
 * asignaciones y nunca otorga `CATALOGOS_ADMINISTRAR` ni facultades implícitas.
 */
export function deriveAuthorizedHospitalsFromProfile(
  profile: ProfileDto | null,
): readonly AuthorizedHospitalOption[] {
  if (!profile || !Array.isArray(profile.assignments)) {
    return [];
  }

  const hospitalMap = new Map<
    string,
    {
      divisionIds: Set<string>;
      permissions: Set<string>;
      hasBroadScope: boolean;
      services: Map<
        string,
        {
          divisionId: string | null;
          kinds: Set<Exclude<AssignmentKind, null>>;
          permissions: Set<string>;
        }
      >;
    }
  >();

  for (const assignment of profile.assignments) {
    const hospitalId = assignment.scope?.hospitalId?.trim();
    if (!hospitalId) {
      continue;
    }

    let entry = hospitalMap.get(hospitalId);
    if (!entry) {
      entry = {
        divisionIds: new Set<string>(),
        permissions: new Set<string>(),
        hasBroadScope: false,
        services: new Map(),
      };
      hospitalMap.set(hospitalId, entry);
    }

    const divisionId = assignment.scope?.divisionId?.trim() || null;
    const servicioId = assignment.scope?.servicioId?.trim() || null;

    if (divisionId) {
      entry.divisionIds.add(divisionId);
    }

    for (const perm of assignment.permissions ?? []) {
      if (perm && perm.trim().length > 0) {
        entry.permissions.add(perm.trim());
      }
    }

    if (servicioId) {
      let srvEntry = entry.services.get(servicioId);
      if (!srvEntry) {
        srvEntry = {
          divisionId,
          kinds: new Set<Exclude<AssignmentKind, null>>(),
          permissions: new Set<string>(),
        };
        entry.services.set(servicioId, srvEntry);
      }
      if (assignment.kind === 'TITULAR' || assignment.kind === 'ENCARGADO') {
        srvEntry.kinds.add(assignment.kind);
      }
      for (const perm of assignment.permissions ?? []) {
        if (perm && perm.trim().length > 0) {
          srvEntry.permissions.add(perm.trim());
        }
      }
    } else {
      entry.hasBroadScope = true;
    }
  }

  const hospitals: AuthorizedHospitalOption[] = [];
  for (const [hospitalId, entry] of hospitalMap.entries()) {
    const explicitServices: AuthorizedServiceOption[] = [];
    for (const [servicioId, srv] of entry.services.entries()) {
      const kinds = Array.from(srv.kinds);
      const kindSuffix = kinds.length > 0 ? ` · ${kinds.join('/')}` : '';
      explicitServices.push({
        hospitalId,
        divisionId: srv.divisionId,
        servicioId,
        displayLabel: `Servicio UUID: ${servicioId}${kindSuffix} (Sin nombre descriptivo en v1)`,
        kinds,
        permissions: Array.from(srv.permissions),
      });
    }

    hospitals.push({
      hospitalId,
      displayLabel: `Hospital UUID: ${hospitalId} (Sin nombre descriptivo en v1)`,
      divisionIds: Array.from(entry.divisionIds),
      explicitServices,
      hasBroadScopeWithoutExplicitServices: entry.hasBroadScope,
      permissions: Array.from(entry.permissions),
    });
  }

  return hospitals;
}

/**
 * Servicio reactivo de sesión IAM V2 y contexto hospitalario autorizado (F4-B).
 *
 * Responsabilidades:
 * - Orquesta `login` -> almacenamiento volátil RAM -> `/auth/me` -> ámbitos autorizados.
 * - Permite seleccionar únicamente `hospitalId` y `servicioId` presentes en `/auth/me`.
 * - Limpia completamente tokens, perfil, ámbitos, sesiones y solicitudes pendientes al
 *   cerrar sesión, cambiar de usuario o detectar revocación.
 * - Mantiene `iamEnabled = false` por defecto (`SYNTHETIC_DEMO` accesible sin login).
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly runtimeConfig = inject(SIGEH_RUNTIME_CONFIG);
  private readonly authHttp = inject(AuthHttpService);
  private readonly tokenStore = inject(EphemeralSessionTokenStore);

  private readonly iamEnabledOverride = signal<boolean | null>(null);
  private readonly profileSignal = signal<ProfileDto | null>(null);
  private readonly sessionsSignal = signal<readonly SessionDto[]>([]);
  private readonly selectedHospitalIdSignal = signal<string | null>(null);
  private readonly selectedServiceIdSignal = signal<string | null>(null);
  private readonly busySignal = signal<boolean>(false);
  private readonly lastErrorSignal = signal<NormalizedHttpError | null>(null);

  public readonly profile = this.profileSignal.asReadonly();
  public readonly sessions = this.sessionsSignal.asReadonly();
  public readonly selectedHospitalId = this.selectedHospitalIdSignal.asReadonly();
  public readonly selectedServiceId = this.selectedServiceIdSignal.asReadonly();
  public readonly isBusy = this.busySignal.asReadonly();
  public readonly lastError = this.lastErrorSignal.asReadonly();
  public readonly sessionStatus = this.tokenStore.sessionStatus;
  public readonly sessionSummary = this.tokenStore.sessionSummary;

  public readonly isIamEnabled = computed<boolean>(
    () => this.iamEnabledOverride() ?? this.runtimeConfig.iamEnabled,
  );

  public readonly isAuthenticated = computed<boolean>(() => {
    const status = this.tokenStore.sessionStatus();
    return (
      this.tokenStore.hasAccessToken() &&
      this.profileSignal() !== null &&
      (status === 'authenticated' || status === 'refreshing')
    );
  });

  public readonly authorizedHospitals = computed<readonly AuthorizedHospitalOption[]>(() =>
    deriveAuthorizedHospitalsFromProfile(this.profileSignal()),
  );

  public readonly selectedHospitalOption = computed<AuthorizedHospitalOption | null>(() => {
    const hospId = this.selectedHospitalIdSignal();
    if (!hospId) {
      return null;
    }
    return this.authorizedHospitals().find((h) => h.hospitalId === hospId) ?? null;
  });

  public readonly authorizedServicesForSelectedHospital = computed<
    readonly AuthorizedServiceOption[]
  >(() => this.selectedHospitalOption()?.explicitServices ?? []);

  public readonly selectedContext = computed<SelectedAuthorizedContext | null>(() => {
    const hospital = this.selectedHospitalOption();
    if (!hospital) {
      return null;
    }
    const srvId = this.selectedServiceIdSignal();
    const matchedService = srvId
      ? hospital.explicitServices.find((s) => s.servicioId === srvId) ?? null
      : null;

    return {
      hospitalId: hospital.hospitalId,
      divisionId: matchedService?.divisionId ?? hospital.divisionIds[0] ?? null,
      servicioId: matchedService?.servicioId ?? null,
      permissions: matchedService ? matchedService.permissions : hospital.permissions,
      isServiceExplicitlyAuthorized: matchedService !== null,
      hasBroadScopeWithoutServiceEnumeration:
        hospital.hasBroadScopeWithoutExplicitServices && hospital.explicitServices.length === 0,
    };
  });

  public readonly scopeLimitationNotice = computed<ScopeLimitationNotice | null>(() => {
    if (!this.isAuthenticated()) {
      return null;
    }
    const hospitals = this.authorizedHospitals();
    if (hospitals.length === 0) {
      return {
        code: 'NO_AUTHORIZED_ASSIGNMENTS',
        message:
          'El perfil devuelto por /api/v1/auth/me no contiene asignaciones hospitalarias autorizadas. No se conceden accesos ni facultades implícitas.',
      };
    }

    const selectedHospital = this.selectedHospitalOption();
    if (
      selectedHospital &&
      selectedHospital.hasBroadScopeWithoutExplicitServices &&
      selectedHospital.explicitServices.length === 0
    ) {
      return {
        code: 'SERVICE_ENUMERATION_UNAVAILABLE_WITHOUT_CATALOG',
        message:
          'El mandato en /auth/me otorga alcance hospitalario/divisional (servicioId = null) sin enumerar servicios hijos. El selector no inventa servicios ni otorga CATALOGOS_ADMINISTRAR; se requiere asignación explícita o catálogo autorizado para elegir servicio.',
      };
    }

    return {
      code: 'DESCRIPTIVE_NAMES_UNAVAILABLE_V1',
      message:
        'Los hospitales y servicios autorizados se derivan estrictamente de /auth/me por identificador UUID; los nombres descriptivos siguen pendientes en x-sigeh-pending-resources.',
    };
  });

  public constructor() {
    // Sincronización defensiva: si el interceptor/coordinador detecta revocación o expiración
    // y limpia `EphemeralSessionTokenStore`, limpiar inmediatamente el estado reactivo del usuario.
    this.tokenStore.sessionCleared$.subscribe((reason) => {
      this.wipeLocalUserState();
      if (reason === 'revoked') {
        this.lastErrorSignal.set({
          status: 401,
          code: 'UNAUTHORIZED_SESSION',
          title: 'Sesión Revocada o Inválida (HTTP 401)',
          message:
            'La sesión fue revocada o el token de renovación ya no es válido. Se limpió la memoria local; inicie sesión nuevamente.',
          timestampIso: new Date().toISOString(),
        });
      }
    });
  }

  public setIamEnabledOverride(enabled: boolean | null): void {
    this.iamEnabledOverride.set(enabled);
  }

  /**
   * Flujo contractual completo:
   * 1) Limpia cualquier sesión previa (cambio de usuario seguro).
   * 2) `POST /api/v1/auth/login` -> almacena tokens en memoria RAM.
   * 3) `GET /api/v1/auth/me` -> establece perfil y ámbitos autorizados.
   */
  public login(credentials: LoginDto): Observable<ProfileDto> {
    // Limpieza previa obligatoria al iniciar sesión o cambiar de usuario
    this.clearAllLocalSessionState('anonymous');
    this.busySignal.set(true);
    this.lastErrorSignal.set(null);

    return this.authHttp.login(credentials).pipe(
      switchMap((tokens) => {
        this.tokenStore.setSessionTokens(tokens);
        return this.authHttp.me().pipe(
          tap((profile) => {
            this.applyAuthorizedProfile(profile);
          }),
          catchError((meErr: unknown) => {
            // Si /auth/me falla tras login, no dejar tokens huérfanos en memoria
            this.clearAllLocalSessionState('anonymous');
            const normalized = this.asNormalizedError(meErr);
            this.lastErrorSignal.set(normalized);
            return throwError(() => normalized);
          }),
        );
      }),
      catchError((err: unknown) => {
        const normalized = this.asNormalizedError(err);
        this.lastErrorSignal.set(normalized);
        return throwError(() => normalized);
      }),
      finalize(() => {
        this.busySignal.set(false);
      }),
    );
  }

  /**
   * Refresca el perfil desde `GET /api/v1/auth/me` y revalida que la selección actual
   * continúe dentro de los ámbitos autorizados.
   */
  public refreshProfile(): Observable<ProfileDto> {
    this.busySignal.set(true);
    this.lastErrorSignal.set(null);

    return this.authHttp.me().pipe(
      tap((profile) => {
        this.applyAuthorizedProfile(profile);
      }),
      catchError((err: unknown) => {
        const normalized = this.asNormalizedError(err);
        this.lastErrorSignal.set(normalized);
        return throwError(() => normalized);
      }),
      finalize(() => {
        this.busySignal.set(false);
      }),
    );
  }

  /**
   * Selecciona un hospital únicamente si está presente en los ámbitos autorizados de `/auth/me`.
   * Rechaza cualquier `hospitalId` fuera de las asignaciones del usuario.
   */
  public selectHospital(hospitalId: string): boolean {
    const matchedHospital = this.authorizedHospitals().find(
      (h) => h.hospitalId === hospitalId,
    );
    if (!matchedHospital) {
      return false;
    }

    this.selectedHospitalIdSignal.set(matchedHospital.hospitalId);
    this.selectedServiceIdSignal.set(matchedHospital.explicitServices[0]?.servicioId ?? null);
    return true;
  }

  /**
   * Selecciona un servicio únicamente si pertenece al hospital activo y está explícitamente
   * autorizado en `/auth/me`. Nunca acepta un `servicioId` arbitrario ni inventado.
   */
  public selectService(servicioId: string): boolean {
    const hospital = this.selectedHospitalOption();
    if (!hospital) {
      return false;
    }

    const matchedService = hospital.explicitServices.find(
      (s) => s.servicioId === servicioId,
    );
    if (!matchedService) {
      return false;
    }

    this.selectedServiceIdSignal.set(matchedService.servicioId);
    return true;
  }

  /**
   * Carga las sesiones activas/históricas del usuario autenticado (`GET /api/v1/auth/sessions`).
   */
  public loadSessions(): Observable<readonly SessionDto[]> {
    this.busySignal.set(true);
    this.lastErrorSignal.set(null);

    return this.authHttp.listSessions().pipe(
      tap((list) => {
        this.sessionsSignal.set(list);
      }),
      catchError((err: unknown) => {
        const normalized = this.asNormalizedError(err);
        this.lastErrorSignal.set(normalized);
        return throwError(() => normalized);
      }),
      finalize(() => {
        this.busySignal.set(false);
      }),
    );
  }

  /**
   * Revoca una sesión específica (`DELETE /api/v1/auth/sessions/{sessionId}`).
   * Si corresponde a la sesión actual, limpia inmediatamente toda la memoria local.
   */
  public revokeSession(sessionId: string): Observable<void> {
    this.busySignal.set(true);
    this.lastErrorSignal.set(null);
    const isCurrentSession = this.tokenStore.getSessionId() === sessionId;
    let revokedSuccessfully = false;

    return this.authHttp.revokeSession(sessionId).pipe(
      tap(() => {
        revokedSuccessfully = true;
        if (!isCurrentSession) {
          const nowIso = new Date().toISOString();
          this.sessionsSignal.update((current) =>
            current.map((s) =>
              s.sessionId === sessionId ? { ...s, revokedAt: nowIso } : s,
            ),
          );
        }
      }),
      catchError((err: unknown) => {
        const normalized = this.asNormalizedError(err);
        this.lastErrorSignal.set(normalized);
        return throwError(() => normalized);
      }),
      finalize(() => {
        if (revokedSuccessfully && isCurrentSession) {
          this.clearAllLocalSessionState('revoked');
        }
        this.busySignal.set(false);
      }),
    );
  }

  /**
   * Cierra sesión en el backend (`POST /api/v1/auth/logout`) y garantiza siempre la limpieza
   * completa de tokens, perfil, ámbitos, sesiones y solicitudes pendientes en memoria RAM.
   */
  public logout(): Observable<void> {
    if (!this.tokenStore.hasAccessToken()) {
      this.clearAllLocalSessionState('anonymous');
      return of(undefined);
    }

    this.busySignal.set(true);
    this.lastErrorSignal.set(null);

    return this.authHttp.logout().pipe(
      catchError(() => {
        // Incluso si el servidor devuelve 401/404/503 durante logout, el cliente SIEMPRE limpia memoria.
        return of(undefined);
      }),
      map(() => undefined),
      finalize(() => {
        this.clearAllLocalSessionState('anonymous');
        this.busySignal.set(false);
      }),
    );
  }

  /**
   * Limpia de forma explícita y síncrona todo el estado sensible en RAM y cancela
   * solicitudes protegidas pendientes.
   */
  public clearAllLocalSessionState(
    reason: Extract<EphemeralSessionStatus, 'anonymous' | 'expired' | 'revoked'> = 'anonymous',
  ): void {
    this.wipeLocalUserState();
    this.lastErrorSignal.set(null);
    this.tokenStore.clearSessionMemory(reason);
  }

  /**
   * Consulta informativa para visibilidad de UI únicamente; NestJS es la única autoridad real.
   */
  public hasPermissionInSelectedContext(permission: string): boolean {
    const ctx = this.selectedContext();
    return Boolean(ctx && ctx.permissions.includes(permission));
  }

  private applyAuthorizedProfile(profile: ProfileDto): void {
    this.profileSignal.set(profile);
    const hospitals = deriveAuthorizedHospitalsFromProfile(profile);

    if (hospitals.length === 0) {
      this.selectedHospitalIdSignal.set(null);
      this.selectedServiceIdSignal.set(null);
      return;
    }

    const currentHospId = this.selectedHospitalIdSignal();
    const validHospital =
      hospitals.find((h) => h.hospitalId === currentHospId) ?? hospitals[0];

    this.selectedHospitalIdSignal.set(validHospital.hospitalId);

    const currentSrvId = this.selectedServiceIdSignal();
    const validService =
      validHospital.explicitServices.find((s) => s.servicioId === currentSrvId) ??
      validHospital.explicitServices[0] ??
      null;

    this.selectedServiceIdSignal.set(validService?.servicioId ?? null);
  }

  private wipeLocalUserState(): void {
    this.profileSignal.set(null);
    this.sessionsSignal.set([]);
    this.selectedHospitalIdSignal.set(null);
    this.selectedServiceIdSignal.set(null);
  }

  private asNormalizedError(err: unknown): NormalizedHttpError {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      'status' in err &&
      'message' in err
    ) {
      return err as NormalizedHttpError;
    }
    return {
      status: -1,
      code: 'NETWORK_ERROR',
      title: 'Error de Autenticación IAM',
      message: 'No fue posible completar la operación IAM solicitada.',
      timestampIso: new Date().toISOString(),
    };
  }
}
