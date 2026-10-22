import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getAccessToken();
  const isApiRequest = isBackendApiRequest(request.url);
  const isPublicAuthRequest = /\/api\/auth\/(login|register)\/?$/.test(
    request.url.split('?')[0]
  );
  const shouldAttachToken =
    isApiRequest && !isPublicAuthRequest && token !== null;

  const authenticatedRequest = shouldAttachToken
    ? request.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isPublicAuthRequest
      ) {
        auth.handleUnauthorized(router.url);
      }
      return throwError(() => error);
    })
  );
};

function isBackendApiRequest(url: string): boolean {
  const apiRoot = environment.apiUrl.replace(/\/+$/, '');
  return url.startsWith(apiRoot ? `${apiRoot}/api/` : '/api/');
}
