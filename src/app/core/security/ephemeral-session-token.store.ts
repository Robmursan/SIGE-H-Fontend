import { computed, Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { TokensDto } from '../contracts/openapi-dtos.contract';

const FORBIDDEN_WEB_STORAGE_KEYS = [
  'access_token',
  'refresh_token',
  'id_token',
  'jwt',
  'auth_token',
  'sigeh_token',
  'sigeh_jwt',
  'sigeh_session',
  'sigeh_refresh_token',
] as const;

export type EphemeralSessionStatus =
  | 'anonymous'
  | 'authenticated'
  | 'refreshing'
  | 'expired'
  | 'revoked';

export interface EphemeralSessionStateSummary {
  readonly status: EphemeralSessionStatus;
  readonly sessionId: string | null;
  readonly tokenType: 'Bearer' | null;
  readonly expiresInSeconds: number | null;
  readonly expiresAtIso: string | null;
  readonly hasAccessToken: boolean;
  readonly hasRefreshToken: boolean;
  readonly sessionEpoch: number;
}

/**
 * Almacén efímero exclusivamente en memoria RAM para credenciales IAM V2 (F4-B).
 *
 * Política de seguridad institucional SIGE-H:
 * - PROHIBIDO almacenar `accessToken`, `refreshToken`, JWT o metadatos sensibles en
 *   `window.localStorage`, `window.sessionStorage`, cookies accesibles por JS o archivos.
 * - Calcula expiración exclusivamente desde `expiresIn` devuelto por el servidor.
 * - Expone `sessionEpoch` y `sessionCleared$` para cancelar solicitudes pendientes
 *   al cerrar sesión, cambiar de usuario o detectar revocación.
 */
@Injectable({ providedIn: 'root' })
export class EphemeralSessionTokenStore {
  private readonly volatileAccessToken = signal<string | null>(null);
  private readonly volatileRefreshToken = signal<string | null>(null);
  private readonly volatileTokenType = signal<'Bearer' | null>(null);
  private readonly volatileExpiresInSeconds = signal<number | null>(null);
  private readonly volatileExpiresAtMs = signal<number | null>(null);
  private readonly volatileSessionId = signal<string | null>(null);
  private readonly volatileStatus = signal<EphemeralSessionStatus>('anonymous');
  private readonly volatileEpoch = signal<number>(0);

  private readonly sessionClearedSubject = new Subject<
    Extract<EphemeralSessionStatus, 'anonymous' | 'expired' | 'revoked'>
  >();
  private readonly explicitLogoutSubject = new Subject<void>();

  public readonly storagePolicy = 'VOLATILE_MEMORY_ONLY_NO_LOCALSTORAGE' as const;

  public readonly sessionCleared$: Observable<
    Extract<EphemeralSessionStatus, 'anonymous' | 'expired' | 'revoked'>
  > = this.sessionClearedSubject.asObservable();

  public readonly explicitLogout$: Observable<void> = this.explicitLogoutSubject.asObservable();

  public readonly sessionStatus = this.volatileStatus.asReadonly();
  public readonly sessionId = this.volatileSessionId.asReadonly();
  public readonly expiresAtMs = this.volatileExpiresAtMs.asReadonly();
  public readonly sessionEpoch = this.volatileEpoch.asReadonly();

  public readonly hasAccessToken = computed<boolean>(
    () => this.volatileAccessToken() !== null,
  );

  public readonly hasRefreshToken = computed<boolean>(
    () => this.volatileRefreshToken() !== null,
  );

  public readonly sessionSummary = computed<EphemeralSessionStateSummary>(() => {
    const expMs = this.volatileExpiresAtMs();
    return {
      status: this.volatileStatus(),
      sessionId: this.volatileSessionId(),
      tokenType: this.volatileTokenType(),
      expiresInSeconds: this.volatileExpiresInSeconds(),
      expiresAtIso: expMs !== null ? new Date(expMs).toISOString() : null,
      hasAccessToken: this.volatileAccessToken() !== null,
      hasRefreshToken: this.volatileRefreshToken() !== null,
      sessionEpoch: this.volatileEpoch(),
    };
  });

  public constructor() {
    this.purgeForbiddenWebStorageKeys();
  }

  /**
   * Almacena el par `TokensDto` de IAM V2 en memoria RAM volátil.
   * Usa exclusivamente el `expiresIn` (segundos) entregado por el servidor.
   */
  public setSessionTokens(tokens: TokensDto, nowMs = Date.now()): void {
    const cleanedAccess = tokens.accessToken?.trim() || null;
    const cleanedRefresh = tokens.refreshToken?.trim() || null;
    const cleanedSessionId = tokens.sessionId?.trim() || null;
    const validExpiresIn =
      typeof tokens.expiresIn === 'number' && Number.isFinite(tokens.expiresIn) && tokens.expiresIn > 0
        ? tokens.expiresIn
        : null;

    this.volatileAccessToken.set(cleanedAccess);
    this.volatileRefreshToken.set(cleanedRefresh);
    this.volatileTokenType.set(cleanedAccess ? tokens.tokenType : null);
    this.volatileExpiresInSeconds.set(validExpiresIn);
    this.volatileExpiresAtMs.set(
      validExpiresIn !== null ? nowMs + validExpiresIn * 1000 : null,
    );
    this.volatileSessionId.set(cleanedSessionId);
    this.volatileStatus.set(cleanedAccess ? 'authenticated' : 'anonymous');
    this.purgeForbiddenWebStorageKeys();
  }

  /**
   * Compatibilidad F3-A/F3-B: establece únicamente el token de acceso en memoria RAM.
   */
  public setEphemeralAccessToken(token: string | null): void {
    const cleaned = token && token.trim().length > 0 ? token.trim() : null;
    this.volatileAccessToken.set(cleaned);
    if (cleaned) {
      this.volatileTokenType.set('Bearer');
      if (this.volatileStatus() === 'anonymous') {
        this.volatileStatus.set('authenticated');
      }
    }
    this.purgeForbiddenWebStorageKeys();
  }

  public getEphemeralAccessToken(): string | null {
    return this.volatileAccessToken();
  }

  public getEphemeralRefreshToken(): string | null {
    return this.volatileRefreshToken();
  }

  public getSessionId(): string | null {
    return this.volatileSessionId();
  }

  public getSessionEpoch(): number {
    return this.volatileEpoch();
  }

  public isAccessTokenExpired(nowMs = Date.now(), safetyWindowMs = 0): boolean {
    const expMs = this.volatileExpiresAtMs();
    if (expMs === null) {
      return false;
    }
    return nowMs + safetyWindowMs >= expMs;
  }

  public markRefreshing(): void {
    if (this.volatileRefreshToken() !== null) {
      this.volatileStatus.set('refreshing');
    }
  }

  public markExpired(): void {
    this.volatileStatus.set('expired');
  }

  /**
   * Limpia completamente todos los tokens, expiración y estado de sesión en RAM,
   * incrementa `sessionEpoch` y notifica en `sessionCleared$` para cancelar
   * solicitudes pendientes de la sesión anterior.
   */
  public clearSessionMemory(
    nextStatus: Extract<EphemeralSessionStatus, 'anonymous' | 'expired' | 'revoked'> = 'anonymous',
  ): void {
    this.volatileAccessToken.set(null);
    this.volatileRefreshToken.set(null);
    this.volatileTokenType.set(null);
    this.volatileExpiresInSeconds.set(null);
    this.volatileExpiresAtMs.set(null);
    this.volatileSessionId.set(null);
    this.volatileStatus.set(nextStatus);
    this.volatileEpoch.update((epoch) => epoch + 1);
    this.purgeForbiddenWebStorageKeys();
    this.sessionClearedSubject.next(nextStatus);
    if (nextStatus === 'anonymous') {
      this.explicitLogoutSubject.next();
    }
  }

  /**
   * Garantiza que ninguna clave sensible quede persistida accidentalmente en
   * `localStorage` ni `sessionStorage`.
   */
  public purgeForbiddenWebStorageKeys(): void {
    try {
      if (typeof window !== 'undefined') {
        for (const key of FORBIDDEN_WEB_STORAGE_KEYS) {
          window.localStorage?.removeItem(key);
          window.sessionStorage?.removeItem(key);
        }
      }
    } catch {
      // Entorno sin acceso a Web Storage (SSR / sandbox estricto)
    }
  }
}
