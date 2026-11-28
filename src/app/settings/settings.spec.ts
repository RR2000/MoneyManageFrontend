import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {SettingsPageComponent} from './settings-page.component';
import {I18nService} from '../i18n/i18n.service';
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

  it('the old addresses lead to the new pages: /classic to the overview', () => {
    expect(routes.find(r => r.path === 'classic')?.redirectTo).toBe('');
    expect(routes.find(r => r.path === 'setup')?.redirectTo).toBe('import');
    expect(routes.find(r => r.path === 'account')?.redirectTo).toBe('settings');
  });
});
