import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GoogleAuthService } from './google-auth.service';

/**
 * Garde de route (cf §F1 du CDC).
 * Redirige vers `/login` si l'utilisateur n'est pas authentifié.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(GoogleAuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};