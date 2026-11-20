import { TestBed } from '@angular/core/testing';
import { EphemeralSessionTokenStore } from './ephemeral-session-token.store';

describe('EphemeralSessionTokenStore (F3-A Zero-LocalStorage Security)', () => {
  let store: EphemeralSessionTokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(EphemeralSessionTokenStore);
  });

  it('should hold tokens strictly in volatile memory and never write to localStorage or sessionStorage', () => {
    expect(store.storagePolicy).toBe('VOLATILE_MEMORY_ONLY_NO_LOCALSTORAGE');
    expect(store.getEphemeralAccessToken()).toBeNull();

    store.setEphemeralAccessToken('demo-ephemeral-jwt-token');
    expect(store.getEphemeralAccessToken()).toBe('demo-ephemeral-jwt-token');

    expect(window.localStorage.getItem('access_token')).toBeNull();
    expect(window.localStorage.getItem('jwt')).toBeNull();
    expect(window.sessionStorage.getItem('access_token')).toBeNull();

    store.clearSessionMemory();
    expect(store.getEphemeralAccessToken()).toBeNull();
  });

  it('should actively purge forbidden token keys from localStorage and sessionStorage', () => {
    window.localStorage.setItem('access_token', 'leaked-token');
    window.sessionStorage.setItem('sigeh_jwt', 'leaked-session-token');

    store.purgeForbiddenWebStorageKeys();

    expect(window.localStorage.getItem('access_token')).toBeNull();
    expect(window.sessionStorage.getItem('sigeh_jwt')).toBeNull();
  });

  it('should store full IAM V2 TokensDto in RAM, compute expiration from server expiresIn and emit sessionCleared$ on wipe (F4-B)', () => {
    const fixedNow = Date.UTC(2026, 10, 18, 21, 0, 0);
    let clearedReasons: string[] = [];
    store.sessionCleared$.subscribe((reason) => clearedReasons.push(reason));

    const initialEpoch = store.getSessionEpoch();
    store.setSessionTokens(
      {
        accessToken: 'ram-access-token',
        refreshToken: 'a'.repeat(64),
        tokenType: 'Bearer',
        expiresIn: 300,
        sessionId: '11111111-1111-4111-8111-111111111111',
      },
      fixedNow,
    );

    expect(store.getEphemeralAccessToken()).toBe('ram-access-token');
    expect(store.getEphemeralRefreshToken()).toBe('a'.repeat(64));
    expect(store.getSessionId()).toBe('11111111-1111-4111-8111-111111111111');
    expect(store.sessionStatus()).toBe('authenticated');
    expect(store.isAccessTokenExpired(fixedNow + 299_000)).toBe(false);
    expect(store.isAccessTokenExpired(fixedNow + 300_000)).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    store.clearSessionMemory('revoked');

    expect(store.getEphemeralAccessToken()).toBeNull();
    expect(store.getEphemeralRefreshToken()).toBeNull();
    expect(store.getSessionId()).toBeNull();
    expect(store.sessionStatus()).toBe('revoked');
    expect(store.getSessionEpoch()).toBe(initialEpoch + 1);
    expect(clearedReasons).toEqual(['revoked']);
  });
});
