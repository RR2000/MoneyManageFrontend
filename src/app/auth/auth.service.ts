import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {Observable, tap} from 'rxjs';

interface AuthResponse {
  token: string;
}

export interface Account {
  username: string;
  /** confirmed email, null if none */
  email: string | null;
  /** false: no SMTP on the server, so no email links */
  emailLinks: boolean;
}

/** Which ways to log in the server offers (GET /api/auth/providers). */
export interface Providers {
  /** username and password, login and sign-up; false with AUTH_MODE=oidc (absent from older servers: on) */
  password?: boolean;
  github: boolean;
  githubUrl?: string;
  /** "forgot password" by email is on */
  passwordReset?: boolean;
  /** "Continue with raoulrondinella.dev", the single sign-on of the site */
  oidc?: boolean;
  oidcUrl?: string;
  /** its logout, with client and way back; the app adds id_token_hint */
  oidcLogoutUrl?: string;
}

/** What the backend puts in the fragment of /login after a login with GitHub or raoulrondinella.dev. */
export interface LoginReturn {
  token?: string;
  idToken?: string;
  /** github-error, or the code of oidc-error (email-unverified, email-unconfirmed, already-linked, unavailable, failed) */
  error?: string;
  oidcError?: string;
}

/** Reads the fragment of /login after a login elsewhere: #token=...&id_token=..., #github-error, #oidc-error=code. */
export function loginReturn(hash: string): LoginReturn {
  if (hash === '#github-error') {
    return {error: 'github-error'};
  }
  const params = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
  const out: LoginReturn = {};
  const token = params.get('token');
  if (token) {
    out.token = token;
    const idToken = params.get('id_token');
    if (idToken) {
      out.idToken = idToken;
    }
  }
  const oidcError = params.get('oidc-error');
  if (oidcError !== null) {
    out.oidcError = oidcError;
  }
  return out;
}

/** The token of a link from an email, in the fragment (#token=...): the fragment never reaches a server log. */
export function tokenFromFragment(hash: string): string {
  return hash.startsWith('#token=') ? decodeURIComponent(hash.substring('#token='.length)) : '';
}

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly tokenKey = 'auth_token';
  /** after a login with raoulrondinella.dev: its id token, only to say who logs out there (id_token_hint) */
  private readonly idTokenKey = 'auth_id_token';

  constructor(private http: HttpClient, private router: Router) {
  }

  /** `username`: the username (any case) or the account's confirmed email. */
  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`/api/auth/login`, {username: username.trim(), password})
      .pipe(tap(res => this.storeToken(res.token)));
  }

  /** `email` is optional: it gets a confirmation link, and once confirmed a forgotten password can be reset. */
  register(username: string, password: string, sampleData: boolean, email = ''): Observable<AuthResponse> {
    const body = email ? {username, password, sampleData, email} : {username, password, sampleData};
    return this.http.post<AuthResponse>(`/api/auth/register`, body)
      .pipe(tap(res => this.storeToken(res.token)));
  }

  /** "Forgot password": the backend answers the same whether an account has this email or not. */
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`/api/auth/password/forgot`, {email});
  }

  /** New password with the token of the link in the email (single use, 30 minutes); answers the username to log in with. */
  resetPassword(token: string, password: string): Observable<{ username: string }> {
    return this.http.post<{ username: string }>(`/api/auth/password/reset`, {token, password});
  }

  /** Confirms the account's email with the token of the link in the email. */
  confirmEmail(token: string): Observable<void> {
    return this.http.post<void>(`/api/auth/email/confirm`, {token});
  }

  account(): Observable<Account> {
    return this.http.get<Account>(`/api/account`);
  }

  /** Sends a confirmation link to the new email; the account changes only when it is opened. */
  changeEmail(email: string): Observable<void> {
    return this.http.post<void>(`/api/account/email`, {email});
  }

  /** Forgets the login in this browser (also on a 401). The session at raoulrondinella.dev, if any, stays. */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.idTokenKey);
  }

  /**
   * The "Log out" button: forgets the login here and, after a login with raoulrondinella.dev, ends the session there
   * too (its end_session_endpoint with id_token_hint), which sends the browser back to the site. Without its logout
   * address (server unreachable, provider not reached yet) only here, and the next "Continue with raoulrondinella.dev"
   * may log in again without asking.
   */
  signOut(): void {
    const idToken = localStorage.getItem(this.idTokenKey);
    this.logout();
    if (!idToken) {
      this.router.navigate(['/login']);
      return;
    }
    this.http.get<Providers>('/api/auth/providers').subscribe({
      next: p => {
        if (p.oidcLogoutUrl) {
          this.leaveTo(p.oidcLogoutUrl + '&id_token_hint=' + encodeURIComponent(idToken));
        } else {
          this.router.navigate(['/login']);
        }
      },
      error: () => this.router.navigate(['/login'])
    });
  }

  /** Leaves the app for another site (a method of its own, so the tests can stop it). */
  leaveTo(url: string): void {
    window.location.assign(url);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /** Token obtained elsewhere (the redirect back from GitHub or raoulrondinella.dev, with its id token). */
  acceptToken(token: string, idToken?: string): void {
    this.storeToken(token);
    if (idToken) {
      localStorage.setItem(this.idTokenKey, idToken);
    } else {
      localStorage.removeItem(this.idTokenKey);
    }
  }

  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }
}
