import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
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
  github: boolean;
  githubUrl?: string;
  /** "forgot password" by email is on */
  passwordReset?: boolean;
}

/** The token of a link from an email, in the fragment (#token=...): the fragment never reaches a server log. */
export function tokenFromFragment(hash: string): string {
  return hash.startsWith('#token=') ? decodeURIComponent(hash.substring('#token='.length)) : '';
}

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly tokenKey = 'auth_token';

  constructor(private http: HttpClient) {
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

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /** Token obtained elsewhere (the redirect back from "Accedi con GitHub"). */
  acceptToken(token: string): void {
    this.storeToken(token);
  }

  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }
}
