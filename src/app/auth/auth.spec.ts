import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {AuthService, linkReturn, loginReturn, tokenFromFragment} from './auth.service';
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

  it('reads the return from GitHub or raoulrondinella.dev: token, id token, error codes', () => {
    expect(loginReturn('#token=abc')).toEqual({token: 'abc'});
    expect(loginReturn('#token=abc&id_token=x.y.z')).toEqual({token: 'abc', idToken: 'x.y.z'});
    expect(loginReturn('#github-error')).toEqual({error: 'github-error'});
    expect(loginReturn('#oidc-error=email-unverified')).toEqual({oidcError: 'email-unverified'});
    expect(loginReturn('')).toEqual({});
  });

  it('reads the return of a link to raoulrondinella.dev: linked with its id token, error codes, nothing', () => {
    expect(linkReturn('#oidc-link=linked&id_token=x.y.z')).toEqual({linked: true, idToken: 'x.y.z'});
    expect(linkReturn('#oidc-link=linked')).toEqual({linked: true});
    expect(linkReturn('#oidc-link-error=already-linked')).toEqual({error: 'already-linked'});
    expect(linkReturn('#token=abc')).toBeNull();
    expect(linkReturn('')).toBeNull();
  });

  it('asks for a link request and unlinks, as the logged-in account', () => {
    localStorage.setItem('auth_token', 'jwt-prova');
    auth.startOidcLink().subscribe(r => expect(r.url).toBe('/api/oauth2/authorization/zitadel?link=t'));
    const start = http.expectOne('/api/account/oidc-link');
    expect(start.request.method).toBe('POST');
    expect(start.request.headers.get('Authorization')).toBe('Bearer jwt-prova');
    start.flush({url: '/api/oauth2/authorization/zitadel?link=t'});
    auth.unlinkOidc().subscribe();
    const unlink = http.expectOne('/api/account/oidc-link');
    expect(unlink.request.method).toBe('DELETE');
    unlink.flush(null, {status: 204, statusText: 'No Content'});
    auth.acceptIdToken('x.y.z');
    expect(localStorage.getItem('auth_id_token')).toBe('x.y.z');
    expect(localStorage.getItem('auth_token')).toBe('jwt-prova');
  });

  it('logs out at raoulrondinella.dev too, with the id token as hint, after a login there', () => {
    auth.acceptToken('abc', 'id.token.value');
    const leave = vi.spyOn(auth, 'leaveTo').mockImplementation(() => undefined);
    auth.signOut();
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('auth_id_token')).toBeNull();
    http.expectOne('/api/auth/providers').flush({
      github: false, oidc: true, oidcUrl: '/api/oauth2/authorization/zitadel',
      oidcLogoutUrl: 'https://auth.example.org/oidc/v1/end_session?client_id=1&post_logout_redirect_uri=https%3A%2F%2Fmoney.example.org%2F'
    });
    expect(leave).toHaveBeenCalledWith('https://auth.example.org/oidc/v1/end_session?client_id=1'
      + '&post_logout_redirect_uri=https%3A%2F%2Fmoney.example.org%2F&id_token_hint=id.token.value');
  });

  it('logs out only here after a password login, or when the logout address is not known', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const leave = vi.spyOn(auth, 'leaveTo').mockImplementation(() => undefined);
    auth.acceptToken('abc');
    auth.signOut();
    expect(navigate).toHaveBeenCalledWith(['/login']);

    auth.acceptToken('abc', 'id.token.value');
    auth.signOut();
    http.expectOne('/api/auth/providers').flush({github: false, oidc: true});
    expect(leave).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
