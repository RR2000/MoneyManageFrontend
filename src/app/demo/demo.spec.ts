import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse, provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {AppComponent} from '../app.component';
import {LoginComponent} from '../login/login.component';
import {SettingsPageComponent} from '../settings/settings-page.component';
import {I18nService} from '../i18n/i18n.service';
import {en} from '../i18n/messages.en';
import {it as itMessages} from '../i18n/messages.it';
import {DEMO_ERRORS, demoCode, demoError, tokenExpiry} from './demo';
import {DemoStartComponent} from './demo-start.component';

// made-up data only
describe('Demo', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const error = (status: number, body: unknown) => new HttpErrorResponse({status, error: body});
  /** a login token with this end (seconds), as the backend makes them: only `exp` is read */
  const token = (exp: number) => 'h.' + btoa(JSON.stringify({sub: 'demo-abcdefghij', exp})).replace(/=+$/, '') + '.s';

  it('the codes of the backend and their texts, in English and in Italian', () => {
    expect(demoCode(error(403, {status: 403, message: 'DEMO_NO_BANKING', code: 'DEMO_NO_BANKING'}))).toBe('DEMO_NO_BANKING');
    // the code in message only (like the other codes of the API), or a body that came as text
    expect(demoCode(error(429, {message: 'DEMO_FULL'}))).toBe('DEMO_FULL');
    expect(demoCode(error(413, '{"code":"DEMO_UPLOAD_TOO_LARGE","limitKb":256}'))).toBe('DEMO_UPLOAD_TOO_LARGE');
    // anything else is not a demo error
    expect(demoCode(error(400, {message: 'UNKNOWN_ASPSP'}))).toBeNull();
    expect(demoCode(error(500, 'Unexpected'))).toBeNull();
    expect(demoCode(new Error('x'))).toBeNull();

    const upload = demoError(error(413, {code: 'DEMO_UPLOAD_TOO_LARGE', limitKb: 64}))!;
    const i18n = TestBed.inject(I18nService);
    expect(i18n.t(upload.key, upload.params)).toBe('In the demo, files up to 64 KB: this one is larger.');
    // the import page asks for text: the body comes as a string, the limit is read the same
    const asText = demoError(error(413, '{"code":"DEMO_UPLOAD_TOO_LARGE","limitKb":128}'))!;
    expect(i18n.t(asText.key, asText.params)).toBe('In the demo, files up to 128 KB: this one is larger.');
    for (const key of Object.values(DEMO_ERRORS)) {
      expect(en[key]).toBeTruthy();
      expect(itMessages[key]).toBeTruthy();
    }
  });

  it('reads the end of a token, and nothing from what is not one', () => {
    expect(tokenExpiry(token(2_000_000_000))).toBe(2_000_000_000_000);
    expect(tokenExpiry('not-a-token')).toBeNull();
    expect(tokenExpiry(null)).toBeNull();
  });

  it('/demo makes a sandbox, keeps its token and goes in, with a wait visible at once', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DemoStartComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('h1'))).toBe('Try the demo');
    expect(text(el.querySelector('[role=status]'))).toContain('Preparing your demo');
    const req = http.expectOne('/api/demo');
    expect(req.request.method).toBe('POST');
    req.flush({token: 'demo-token'}, {status: 201, statusText: 'Created'});
    expect(localStorage.getItem('auth_token')).toBe('demo-token');
    expect(navigate).toHaveBeenCalledWith(['/'], {replaceUrl: true});
  });

  it('/demo with a login still open goes in without a new sandbox', () => {
    localStorage.setItem('auth_token', token(Math.floor(Date.now() / 1000) + 3600));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.createComponent(DemoStartComponent).detectChanges();
    http.expectNone('/api/demo');
    expect(navigate).toHaveBeenCalledWith(['/'], {replaceUrl: true});
  });

  it('/demo with an old login: a new sandbox', () => {
    localStorage.setItem('auth_token', token(Math.floor(Date.now() / 1000) - 10));
    TestBed.createComponent(DemoStartComponent).detectChanges();
    expect(localStorage.getItem('auth_token')).toBeNull();
    http.expectOne('/api/demo').flush({token: 'new'}, {status: 201, statusText: 'Created'});
  });

  it('/demo over the limits says why, in Italian too', () => {
    const fixture = TestBed.createComponent(DemoStartComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    http.expectOne('/api/demo').flush({status: 429, code: 'DEMO_LIMIT_IP', message: 'DEMO_LIMIT_IP'},
      {status: 429, statusText: 'Too Many Requests'});
    fixture.detectChanges();
    expect(text(el.querySelector('[role=alert]'))).toContain('three demos from this connection');
    // trying again now is pointless: only the way to log in or sign up
    expect(Array.from(el.querySelectorAll('button')).map(text)).not.toContain('Retry');
    expect(el.querySelector('a[href="/login"]')).toBeTruthy();

    TestBed.inject(I18nService).setLang('it');
    fixture.componentInstance.create();
    http.expectOne('/api/demo').flush({code: 'DEMO_FULL', message: 'DEMO_FULL'}, {status: 429, statusText: 'Too Many Requests'});
    fixture.detectChanges();
    expect(text(el.querySelector('[role=alert]'))).toContain('troppe demo aperte');
    expect(Array.from(el.querySelectorAll('button')).map(text)).toContain('Riprova');

    fixture.componentInstance.create();
    http.expectOne('/api/demo').flush({message: 'The demo is off'}, {status: 404, statusText: 'Not Found'});
    fixture.detectChanges();
    expect(text(el.querySelector('[role=alert]'))).toBe('La demo non e\' disponibile su questo sito.');
  });

  it('the login page offers the demo only when the server has it', () => {
    let fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/providers').flush({password: true, github: false, oidc: false, demo: true});
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a.demo-button');
    expect(text(link)).toBe('Try the demo');
    expect(link?.getAttribute('href')).toBe('/demo');

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/providers').flush({password: true, github: false, oidc: false});
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('a.demo-button')).toBeNull();
  });

  it('the bar of a sandbox: on top, readable, the way to a real account', async () => {
    localStorage.setItem('auth_token', 'demo-token');
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    http.expectOne('/api/account').flush({username: 'demo-abcdefghij', email: null, emailLinks: true, demo: true,
      banking: false, expiresAt: '2026-11-29T10:00:00Z', demoHours: 24, demoMaxUploadKb: 256});
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const bar = el.querySelector('.demo-bar')!;
    expect(bar.getAttribute('role')).toBe('region');
    expect(bar.getAttribute('aria-label')).toBe('Demo');
    expect(text(bar)).toContain('Demo: made-up data, gone after 24 hours.');
    // before the side bar and the page, so it is read first; no banks for a sandbox
    expect(el.querySelector('app-demo-bar + .shell')).toBeTruthy();
    expect(text(el.querySelector('nav'))).not.toContain('Banks');

    TestBed.inject(I18nService).setLang('it');
    fixture.detectChanges();
    expect(text(el.querySelector('.demo-bar'))).toContain('Demo: dati finti, spariscono dopo 24 ore.');

    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const real = Array.from(el.querySelectorAll<HTMLButtonElement>('.demo-bar button')).find(b => text(b) === 'Crea un account vero')!;
    real.click();
    fixture.detectChanges();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {queryParams: {mode: 'register'}});
    expect(el.querySelector('.demo-bar')).toBeNull();
  });

  it('a real account has no bar', async () => {
    localStorage.setItem('auth_token', 'real-token');
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl('/');
    http.expectOne('/api/account').flush({username: 'utente-prova', email: null, emailLinks: true, demo: false, banking: false});
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.demo-bar')).toBeNull();
  });

  it('settings of a sandbox: what is off and why, no email or raoulrondinella.dev forms', () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/account').flush({username: 'demo-abcdefghij', email: null, emailLinks: true, oidc: true,
      oidcLinked: false, demo: true, banking: false, expiresAt: '2026-11-29T10:00:00Z', demoHours: 24, demoMaxUploadKb: 256});
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('#settings-demo'))).toBe('This is a demo');
    const off = Array.from(el.querySelectorAll('.off li')).map(text);
    expect(off).toContain('files: up to 256 KB');
    expect(off.join(' ')).toContain('banks');
    expect(el.querySelector('#settings-email')).toBeNull();
    expect(el.querySelector('#settings-sso')).toBeNull();
  });

  it('the sign-up opens from "Create a real account"', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [provideRouter([{path: 'login', component: LoginComponent}]),
      provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login?mode=register', LoginComponent);
    http.expectOne('/api/auth/providers').flush({password: true, github: false, oidc: false, demo: true});
    harness.detectChanges();
    expect(text(harness.routeNativeElement?.querySelector('h1'))).toBe('Create an account');
  });
});
