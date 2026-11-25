import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {AuthService} from './auth.service';
import {authInterceptor} from './auth.interceptor';

describe('auth', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('keeps the token after register and sends it on the next calls', () => {
    auth.register('demo', 'password123', true).subscribe();
    const reg = http.expectOne('/api/auth/register');
    expect(reg.request.body).toEqual({username: 'demo', password: 'password123', sampleData: true});
    reg.flush({token: 'abc'});
    expect(auth.isLoggedIn()).toBe(true);

    TestBed.inject(HttpClient).get('/api/realestate').subscribe();
    expect(http.expectOne('/api/realestate').request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('logs out and goes to the login page on a 401', () => {
    localStorage.setItem('auth_token', 'expired');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    TestBed.inject(HttpClient).get('/api/realestate').subscribe({error: () => undefined});
    http.expectOne('/api/realestate').flush('', {status: 401, statusText: 'Unauthorized'});

    expect(auth.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
