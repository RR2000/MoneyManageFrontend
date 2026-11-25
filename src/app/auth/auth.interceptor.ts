import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {catchError, throwError} from 'rxjs';
import {AuthService} from './auth.service';

/** Adds the token; a 401 (token expired, or the server restarted) sends the user back to the login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  if (token) {
    req = req.clone({setHeaders: {Authorization: `Bearer ${token}`}});
  }
  return next(req).pipe(catchError((err: unknown) => {
    if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith('/api/auth/')) {
      auth.logout();
      router.navigate(['/login']);
    }
    return throwError(() => err);
  }));
};
