import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
import {environment} from '../../environments/environment';

interface AuthResponse {
  token: string;
}

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly tokenKey = 'auth_token';

  constructor(private http: HttpClient) {
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/login`, {username, password})
      .pipe(tap(res => this.storeToken(res.token)));
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/register`, {username, password})
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

  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }
}
