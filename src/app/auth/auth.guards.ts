import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }

  const requestedUrl = route.queryParamMap.get('returnUrl');
  return router.parseUrl(
    isSafeInternalUrl(requestedUrl) ? requestedUrl : '/dashboard'
  );
};

export function isSafeInternalUrl(url: string | null): url is string {
  return url !== null && url.startsWith('/') && !url.startsWith('//');
}
