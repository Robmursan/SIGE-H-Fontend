import { Injectable, signal } from '@angular/core';

const FORBIDDEN_WEB_STORAGE_KEYS = [
  'access_token',
  'refresh_token',
  'id_token',
  'jwt',
  'auth_token',
  'sigeh_token',
  'sigeh_jwt',
] as const;

/**
 * Almacén efímero en memoria RAM para credenciales de sesión (F3-A).
 *
 * Política de seguridad institucional SIGE-H:
 * - PROHIBIDO almacenar tokens JWT, Bearer o credenciales sensibles en
 *   `window.localStorage` o `window.sessionStorage` (prevención de exfiltración XSS).
 * - En F3-A la autenticación real permanece inactiva; cuando se habilite IAM en
 *   fases posteriores, el token de acceso residirá exclusivamente en memoria
 *   volátil de este servicio (o mediante cookies HttpOnly SameSite=Strict).
 */
@Injectable({ providedIn: 'root' })
export class EphemeralSessionTokenStore {
  private readonly volatileAccessToken = signal<string | null>(null);

  public readonly storagePolicy = 'VOLATILE_MEMORY_ONLY_NO_LOCALSTORAGE' as const;

  public constructor() {
    this.purgeForbiddenWebStorageKeys();
  }

  public setEphemeralAccessToken(token: string | null): void {
    const cleaned = token && token.trim().length > 0 ? token.trim() : null;
    this.volatileAccessToken.set(cleaned);
    this.purgeForbiddenWebStorageKeys();
  }

  public getEphemeralAccessToken(): string | null {
    return this.volatileAccessToken();
  }

  public clearSessionMemory(): void {
    this.volatileAccessToken.set(null);
    this.purgeForbiddenWebStorageKeys();
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
