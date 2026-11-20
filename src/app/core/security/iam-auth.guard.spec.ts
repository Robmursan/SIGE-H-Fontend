import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_SIGEH_RUNTIME_CONFIG,
  SIGEH_RUNTIME_CONFIG,
} from '../config/environment.config';
import { AuthSessionService } from './auth-session.service';
import { EphemeralSessionTokenStore } from './ephemeral-session-token.store';
import { iamAuthGuard } from './iam-auth.guard';

describe('iamAuthGuard (F4-B Opt-In Route Protection)', () => {
  const mockState = { url: '/personal' } as RouterStateSnapshot;

  it('should allow access by default when iamEnabled = false (preserving SYNTHETIC_DEMO)', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    const result = TestBed.runInInjectionContext(() => iamAuthGuard({} as never, mockState));
    expect(result).toBe(true);
  });

  it('should redirect to /login with returnUrl when iamEnabled = true and user is unauthenticated', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: { ...DEFAULT_SIGEH_RUNTIME_CONFIG, iamEnabled: true },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() => iamAuthGuard({} as never, mockState));

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fpersonal');
  });

  it('should require verified /auth/me profile and allow access once full IAM session is authenticated', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SIGEH_RUNTIME_CONFIG,
          useValue: { ...DEFAULT_SIGEH_RUNTIME_CONFIG, iamEnabled: true },
        },
      ],
    });

    const authSession = TestBed.inject(AuthSessionService);
    const tokenStore = TestBed.inject(EphemeralSessionTokenStore);
    const httpMock = TestBed.inject(HttpTestingController);

    // Token en memoria sin perfil /auth/me verificado todavía bloquea
    tokenStore.setSessionTokens({
      accessToken: 'valid-token',
      refreshToken: 'a'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: '11111111-1111-4111-8111-111111111111',
    });
    const resultWithoutMe = TestBed.runInInjectionContext(() =>
      iamAuthGuard({} as never, mockState),
    );
    expect(resultWithoutMe instanceof UrlTree).toBe(true);

    // Tras login + /auth/me completo, el guard permite acceso
    const loginPromise = firstValueFrom(
      authSession.login({ identificador: 'jefa_demo', password: 'pwd' }),
    );
    httpMock.expectOne('/api/v1/auth/login').flush({
      accessToken: 'valid-token-2',
      refreshToken: 'b'.repeat(64),
      tokenType: 'Bearer',
      expiresIn: 300,
      sessionId: '11111111-1111-4111-8111-111111111111',
    });
    httpMock.expectOne('/api/v1/auth/me').flush({
      usuarioId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      provider: 'local',
      assignments: [],
    });
    await loginPromise;

    const allowedResult = TestBed.runInInjectionContext(() =>
      iamAuthGuard({} as never, mockState),
    );
    expect(allowedResult).toBe(true);
    httpMock.verify();
  });
});
