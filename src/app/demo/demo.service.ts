import {inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {map, Observable} from 'rxjs';
import {Account, AuthService} from '../auth/auth.service';

/** A demo sandbox: when it ends, how long sandboxes last, the largest file it uploads. */
export interface DemoInfo {
  expiresAt: string | null;
  hours: number;
  maxUploadKb: number;
}

/**
 * "Try the demo": a sandbox of one's own with made-up data (POST /api/demo), and whether the account logged in is one:
 * then the app shows the demo bar and says why bank, mail and the single sign-on are not there. Whether it is one comes
 * from the GET /api/account the app makes once per login (BankingService.checkAvailability), not from a call of its own.
 */
@Injectable({providedIn: 'root'})
export class DemoService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** null: not a sandbox (or not known yet) */
  readonly info = signal<DemoInfo | null>(null);

  /** The account logged in, as GET /api/account answered it; null: no login. */
  accept(account: Account | null): void {
    this.info.set(demoInfo(account));
  }

  /** A new sandbox; its token becomes the login of this browser. */
  start(): Observable<void> {
    return this.http.post<{ token: string }>('/api/demo', null).pipe(map(r => this.auth.acceptToken(r.token)));
  }

  /** "Create a real account": leaves the sandbox (it ends by itself) and opens the sign-up. */
  leave(): void {
    this.auth.logout();
    this.info.set(null);
    this.router.navigate(['/login'], {queryParams: {mode: 'register'}});
  }
}

export function demoInfo(a: Account | null | undefined): DemoInfo | null {
  if (!a?.demo) {
    return null;
  }
  return {expiresAt: a.expiresAt ?? null, hours: a.demoHours ?? 24, maxUploadKb: a.demoMaxUploadKb ?? 256};
}
