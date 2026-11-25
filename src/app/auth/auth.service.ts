import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap} from 'rxjs';

interface AuthResponse {
  token: string;
}

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly tokenKey = 'auth_token';

  constructor(private http: HttpClient) {
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`/api/auth/login`, {username, password})
      .pipe(tap(res => this.storeToken(res.token)));
  }

  register(username: string, password: string, sampleData: boolean): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`/api/auth/register`, {username, password, sampleData})
      .pipe(tap(res => this.storeToken(res.token)));
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
