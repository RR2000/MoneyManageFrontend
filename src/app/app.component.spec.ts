import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {AppComponent} from './app.component';

describe('AppComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.restoreAllMocks());

  const button = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === text) as HTMLButtonElement;

  it('is in English, and the switch changes the language at once and remembers it', () => {
    localStorage.setItem('auth_token', 'fake');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('nav')?.textContent).toContain('Import files');
    expect(el.querySelector('nav')?.textContent).toContain('Log out');

    button(el, 'Italiano').click();
    fixture.detectChanges();
    expect(el.querySelector('nav')?.textContent).toContain('Importa file');
    expect(button(el, 'English')).toBeTruthy();
    expect(localStorage.getItem('lang')).toBe('it');
  });

  it('"Banks" is in the menu only when the account says the feature is there', async () => {
    localStorage.setItem('auth_token', 'fake');
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl('/');
    http.expectOne('/api/account').flush({username: 'demo', email: null, emailLinks: false, banking: true});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')?.textContent).toContain('Banks');

    localStorage.setItem('auth_token', 'another');
    await TestBed.inject(Router).navigateByUrl('/?again');
    http.expectOne('/api/account').flush({username: 'other', email: null, emailLinks: false, banking: false});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')?.textContent).not.toContain('Banks');
  });

  it('offers Italian once to a browser in Italian; the answer is remembered', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('it-IT');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.lang-suggest')?.textContent).toContain('disponibile anche in italiano');
    expect(el.querySelector('.lang-bar')?.textContent).toContain('Italiano');

    button(el, 'Keep English').click();
    fixture.detectChanges();
    expect(el.querySelector('.lang-suggest')).toBeNull();
    expect(localStorage.getItem('lang')).toBe('en');
  });

  it('one address per section: side bar and bar at the bottom with the same pages, the current one marked', async () => {
    localStorage.setItem('auth_token', 'fake');
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    router.resetConfig([{path: '**', children: []}]);
    await router.navigateByUrl('/investments');
    http.expectOne('/api/account').flush({username: 'demo', email: null, emailLinks: false, banking: false});
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const side = Array.from(el.querySelectorAll('nav.side a')).map(a => a.getAttribute('href'));
    expect(side).toEqual(['/', '/', '/accounts', '/investments', '/costs', '/plan', '/assets', '/import', '/settings']);
    const bottom = Array.from(el.querySelectorAll('nav.bottomnav a'));
    expect(bottom.map(a => a.getAttribute('href'))).toEqual(['/', '/accounts', '/investments', '/plan', '/more']);
    expect(bottom.map(a => a.textContent?.trim())).toEqual(['Home', 'Accounts', 'Investments', 'Plan', 'More']);
    expect(el.querySelector('nav.bottomnav a[aria-current="page"]')?.getAttribute('href')).toBe('/investments');

    // a section reached from "More" marks "More"
    await router.navigateByUrl('/settings');
    fixture.detectChanges();
    expect(el.querySelector('nav.bottomnav a[aria-current="page"]')?.getAttribute('href')).toBe('/more');
  });
});
