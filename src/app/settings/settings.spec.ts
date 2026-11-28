import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {SettingsPageComponent} from './settings-page.component';
import {I18nService} from '../i18n/i18n.service';
import {AuthService} from '../auth/auth.service';
import {routes} from '../app.routes';

// made-up data only
describe('Settings', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** the text a screen reader reads: without the parts hidden from it (the "r" mark of raoulrondinella.dev) */
  const spoken = (el: Element | null | undefined) => {
    const copy = el?.cloneNode(true) as Element | undefined;
    copy?.querySelectorAll('[aria-hidden=true]').forEach(n => n.remove());
    return text(copy);
  };

  function open() {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    return {fixture, page: fixture.componentInstance, el: fixture.nativeElement as HTMLElement};
  }

  it('the account, the email form with its checks, language and theme, log out', () => {
    const {fixture, page, el} = open();
    expect(text(el.querySelector('h1'))).toBe('Settings');
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();
    http.expectOne('/api/account').flush({username: 'utente-prova', email: null, emailLinks: true});
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.facts dt, .facts dd')).map(text)).toEqual(['Username', 'utente-prova', 'Email', 'none']);
    expect(text(el.querySelector('#settings-email'))).toBe('Add an email');

    page.email = 'non-una-mail';
    page.submit();
    fixture.detectChanges();
    expect(text(el.querySelector('[role=alert]'))).toBe('Write a valid email address.');
    expect(el.querySelector('#settings-email-input')?.getAttribute('aria-invalid')).toBe('true');

    page.email = 'prova@example.com';
    page.submit();
    http.expectOne('/api/account/email').flush(null);
    fixture.detectChanges();
    expect(text(el.querySelector('form [role=status]'))).toContain('We sent a link to prova@example.com');

    const lang = el.querySelector<HTMLSelectElement>('#settings-lang')!;
    expect(el.querySelector('label[for="settings-lang"]')).toBeTruthy();
    lang.value = 'it';
    lang.dispatchEvent(new Event('change'));
    expect(TestBed.inject(I18nService).lang()).toBe('it');
    expect(el.querySelector('app-theme-switch')?.getAttribute('aria-labelledby')).toBe('settings-theme');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.logout();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('an account that cannot be read says so with Retry', () => {
    const {fixture, el} = open();
    http.expectOne('/api/account').flush('', {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('app-load-state [role=alert] button')!.click();
    http.expectOne('/api/account').flush({username: 'utente-prova', email: 'prova@example.com', emailLinks: false});
    fixture.detectChanges();
    expect(text(el.querySelector('.facts'))).toContain('prova@example.com');
    // without email on the server, no email form
    expect(el.querySelector('#settings-email')).toBeNull();
  });

  describe('raoulrondinella.dev', () => {
    const base = {username: 'utente-prova', email: null, emailLinks: false};

    afterEach(() => history.replaceState(null, '', '/'));

    it('not shown when the server has no single sign-on', () => {
      const {fixture, el} = open();
      http.expectOne('/api/account').flush({...base, oidc: false, oidcLinked: false});
      fixture.detectChanges();
      expect(el.querySelector('#settings-sso')).toBeNull();
    });

    it('not linked: "Link to raoulrondinella.dev" asks for a link request and leaves for it, with a visible wait', () => {
      const leave = vi.spyOn(TestBed.inject(AuthService), 'leaveTo').mockImplementation(() => undefined);
      const {fixture, el} = open();
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: false, oidcCanUnlink: false});
      fixture.detectChanges();
      expect(text(el.querySelector('#settings-sso'))).toBe('raoulrondinella.dev');
      expect(text(el.querySelector('section[aria-labelledby=settings-sso] .hint'))).toContain('even if the two accounts have different emails');
      const button = el.querySelector<HTMLButtonElement>('button.sso-button')!;
      expect(spoken(button)).toBe('Link to raoulrondinella.dev');
      button.click();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);
      expect(text(el.querySelector('section[aria-labelledby=settings-sso] [role=status]'))).toBe('Opening raoulrondinella.dev...');
      const start = http.expectOne('/api/account/oidc-link');
      expect(start.request.method).toBe('POST');
      start.flush({url: '/api/oauth2/authorization/zitadel?link=t'});
      expect(leave).toHaveBeenCalledWith('/api/oauth2/authorization/zitadel?link=t');
    });

    it('linked meanwhile (409): reads the account again; another failure is said', () => {
      const {fixture, el} = open();
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: false});
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('button.sso-button')!.click();
      http.expectOne('/api/account/oidc-link').flush({error: 'linked'}, {status: 409, statusText: 'Conflict'});
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: true, oidcCanUnlink: true});
      fixture.detectChanges();
      expect(spoken(el.querySelector('.sso-state'))).toBe('Linked to raoulrondinella.dev');

      const again = open();
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: false});
      again.fixture.detectChanges();
      again.el.querySelector<HTMLButtonElement>('button.sso-button')!.click();
      http.expectOne('/api/account/oidc-link').flush('', {status: 500, statusText: 'Server Error'});
      again.fixture.detectChanges();
      expect(text(again.el.querySelector('section[aria-labelledby=settings-sso] [role=alert]'))).toBe('Request failed, try again.');
      expect(again.el.querySelector<HTMLButtonElement>('button.sso-button')!.disabled).toBe(false);
    });

    it('linked: "Unlink" asks first, Cancel keeps it, Yes unlinks', async () => {
      const {fixture, el} = open();
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: true, oidcCanUnlink: true});
      fixture.detectChanges();
      expect(spoken(el.querySelector('.sso-state'))).toBe('Linked to raoulrondinella.dev');
      expect(el.querySelector('button.sso-button')).toBeNull();
      el.querySelector<HTMLButtonElement>('button.unlink')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(text(el.querySelector('.confirm .q'))).toBe('Unlink from raoulrondinella.dev? You will log in here with the password (or GitHub) only.');
      expect(document.activeElement).toBe(el.querySelector('.confirm .no'));
      el.querySelector<HTMLButtonElement>('.confirm .no')!.click();
      fixture.detectChanges();
      expect(el.querySelector('.confirm')).toBeNull();

      el.querySelector<HTMLButtonElement>('button.unlink')!.click();
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('.confirm .yes')!.click();
      fixture.detectChanges();
      expect(text(el.querySelector('.confirm .yes'))).toBe('Please wait...');
      const unlink = http.expectOne('/api/account/oidc-link');
      expect(unlink.request.method).toBe('DELETE');
      unlink.flush(null, {status: 204, statusText: 'No Content'});
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: false, oidcCanUnlink: false});
      fixture.detectChanges();
      expect(text(el.querySelector('section[aria-labelledby=settings-sso] [role=status]'))).toBe('Unlinked from raoulrondinella.dev.');
      expect(el.querySelector('button.sso-button')).toBeTruthy();
    });

    it('linked and the only way in: no "Unlink"; a refused unlink is said', () => {
      const {fixture, el} = open();
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: true, oidcCanUnlink: false});
      fixture.detectChanges();
      expect(el.querySelector('button.unlink')).toBeNull();
      expect(text(el.querySelector('section[aria-labelledby=settings-sso] .hint'))).toBe('raoulrondinella.dev is the only way to log in here: it cannot be unlinked.');

      const other = open();
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: true, oidcCanUnlink: true});
      other.fixture.detectChanges();
      other.el.querySelector<HTMLButtonElement>('button.unlink')!.click();
      other.fixture.detectChanges();
      other.el.querySelector<HTMLButtonElement>('.confirm .yes')!.click();
      http.expectOne('/api/account/oidc-link').flush({error: 'only-login'}, {status: 409, statusText: 'Conflict'});
      other.fixture.detectChanges();
      expect(text(other.el.querySelector('section[aria-labelledby=settings-sso] [role=alert]'))).toBe('raoulrondinella.dev is the only way to log in here: it cannot be unlinked.');
    });

    it('back from raoulrondinella.dev: linked (the id token kept for the logout) or the error, then the address is clean', () => {
      history.replaceState(null, '', '/settings#oidc-link=linked&id_token=x.y.z');
      const {fixture, el} = open();
      expect(window.location.hash).toBe('');
      expect(localStorage.getItem('auth_id_token')).toBe('x.y.z');
      http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: true, oidcCanUnlink: true});
      fixture.detectChanges();
      expect(text(el.querySelector('section[aria-labelledby=settings-sso] [role=status]'))).toBe('Linked: from now on "Continue with raoulrondinella.dev" logs you in to this account.');

      for (const [code, message] of [
        ['already-linked', 'That raoulrondinella.dev account is already linked to another money account.'],
        ['other-subject', 'This money account is already linked to another raoulrondinella.dev account: unlink it first.'],
        ['expired', 'The link request expired or was already used: press "Link to raoulrondinella.dev" again.'],
        ['unavailable', 'raoulrondinella.dev cannot be reached right now: try again in a few minutes.'],
        ['constructor', 'Linking to raoulrondinella.dev did not work: try again.']
      ]) {
        history.replaceState(null, '', '/settings#oidc-link-error=' + code);
        const back = open();
        http.expectOne('/api/account').flush({...base, oidc: true, oidcLinked: false});
        back.fixture.detectChanges();
        expect(text(back.el.querySelector('section[aria-labelledby=settings-sso] [role=alert]'))).toBe(message);
        expect(window.location.hash).toBe('');
      }
    });
  });

  it('the old addresses lead to the new pages: /classic to the overview', () => {
    expect(routes.find(r => r.path === 'classic')?.redirectTo).toBe('');
    expect(routes.find(r => r.path === 'setup')?.redirectTo).toBe('import');
    expect(routes.find(r => r.path === 'account')?.redirectTo).toBe('settings');
  });
});
