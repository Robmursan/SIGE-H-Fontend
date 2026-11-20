import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

/**
 * Guard de protección de rutas IAM V2 (F4-B).
 *
 * Comportamiento seguro por diseño:
 * - Cuando `iamEnabled === false` (valor predeterminado), permite la navegación libre
 *   para conservar `SYNTHETIC_DEMO` accesible sin requerir autenticación real.
 * - Cuando `iamEnabled === true`, exige sesión autenticada válida en memoria RAM
 *   (`AuthSessionService.isAuthenticated()`). Si no existe, redirige a `/login`
 *   conservando `returnUrl`.
 */
export const iamAuthGuard: CanActivateFn = (_route, state) => {
  const authSession = inject(AuthSessionService);
  const router = inject(Router);

  if (!authSession.isIamEnabled()) {
    return true;
  }

  if (authSession.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: {
      returnUrl: state.url && state.url !== '/login' ? state.url : '/dashboard',
    },
  });
};
