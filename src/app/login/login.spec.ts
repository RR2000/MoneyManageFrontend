import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {LoginComponent} from './login.component';
import {I18nService} from '../i18n/i18n.service';

// made-up data only
describe('Login', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/login');
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function open(providers: object) {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/providers').flush(providers);
    fixture.detectChanges();
    return {fixture, el: fixture.nativeElement as HTMLElement};
  }

  it('without raoulrondinella.dev: the password form as before', () => {
    const {el} = open({password: true, github: true, githubUrl: '/api/oauth2/authorization/github', oidc: false});
    expect(el.querySelector('.sso-button')).toBeNull();
    expect(el.querySelector('form')).toBeTruthy();
    expect(el.querySelector('button[type=submit]')?.classList.contains('primary')).toBe(true);
  });

  it('both: "Continue with raoulrondinella.dev" first, then the password form', () => {
    const {el} = open({password: true, github: false, oidc: true, oidcUrl: '/api/oauth2/authorization/zitadel'});
    const button = el.querySelector<HTMLAnchorElement>('a.sso-button')!;
    expect(text(button)).toMatch(/Continue with raoulrondinella.dev$/);
    expect(button.getAttribute('href')).toBe('/api/oauth2/authorization/zitadel');
    expect(button.classList.contains('primary')).toBe(true);
    expect(el.querySelector('form')).toBeTruthy();
    // one primary button only
    expect(el.querySelector('button[type=submit]')?.classList.contains('primary')).toBe(false);
  });

  it('only raoulrondinella.dev: no password form, in Italian too', () => {
    TestBed.inject(I18nService).setLang('it');
    const {el} = open({password: false, github: false, oidc: true, oidcUrl: '/api/oauth2/authorization/zitadel'});
    expect(el.querySelector('form')).toBeNull();
    expect(text(el.querySelector('h1'))).toBe('Accedi');
    expect(text(el.querySelector('a.sso-button'))).toMatch(/Entra con raoulrondinella.dev$/);
  });

  it('back with a token and an id token: both kept, then the overview', () => {
    history.replaceState(null, '', '/login#token=abc&id_token=x.y.z');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    expect(localStorage.getItem('auth_token')).toBe('abc');
    expect(localStorage.getItem('auth_id_token')).toBe('x.y.z');
    expect(window.location.hash).toBe('');
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('back with an error code: its text next to the button', () => {
    history.replaceState(null, '', '/login#oidc-error=email-unconfirmed');
    const {el} = open({password: true, github: false, oidc: true, oidcUrl: '/api/oauth2/authorization/zitadel'});
    expect(text(el.querySelector('.sso [role=alert]'))).toContain('waiting for this email to be confirmed');
    expect(window.location.hash).toBe('');
  });

  it('an unknown error code: the generic text', () => {
    history.replaceState(null, '', '/login#oidc-error=something-else');
    const {el} = open({password: true, github: false, oidc: true, oidcUrl: '/api/oauth2/authorization/zitadel'});
    expect(text(el.querySelector('.sso [role=alert]'))).toBe('Login with raoulrondinella.dev failed: try again.');
  });
});
