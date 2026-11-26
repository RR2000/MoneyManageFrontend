import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {AuthService, tokenFromFragment} from './auth.service';
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

  it('sends the optional email at registration only when given', () => {
    auth.register('demo', 'password123', false, 'demo@example.com').subscribe();
    const reg = http.expectOne('/api/auth/register');
    expect(reg.request.body).toEqual({username: 'demo', password: 'password123', sampleData: false, email: 'demo@example.com'});
    reg.flush({token: 'abc'});
  });

  it('asks for a reset link and sets the new password with the token, in the body', () => {
    auth.forgotPassword('demo@example.com').subscribe();
    const forgot = http.expectOne('/api/auth/password/forgot');
    expect(forgot.request.method).toBe('POST');
    expect(forgot.request.body).toEqual({email: 'demo@example.com'});
    forgot.flush(null, {status: 202, statusText: 'Accepted'});

    auth.resetPassword('tok', 'new-password').subscribe();
    const reset = http.expectOne('/api/auth/password/reset');
    expect(reset.request.body).toEqual({token: 'tok', password: 'new-password'});
    reset.flush({username: 'demo'});

    auth.confirmEmail('tok2').subscribe();
    expect(http.expectOne('/api/auth/email/confirm').request.body).toEqual({token: 'tok2'});
  });

  it('logs in with a username or an email, without the spaces around it', () => {
    auth.login('  Demo@Example.com ', 'password123').subscribe();
    const login = http.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({username: 'Demo@Example.com', password: 'password123'});
    login.flush({token: 'abc'});
    expect(auth.getToken()).toBe('abc');
  });

  it('reads the token of an email link from the fragment', () => {
    expect(tokenFromFragment('#token=abc_-123')).toBe('abc_-123');
    expect(tokenFromFragment('#other')).toBe('');
    expect(tokenFromFragment('')).toBe('');
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
