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
});
