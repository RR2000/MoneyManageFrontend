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
    expect(el.querySelector('nav')?.textContent).toContain('Import');
    expect(el.querySelector('nav')?.textContent).toContain('Log out');

    button(el, 'Italiano').click();
    fixture.detectChanges();
    expect(el.querySelector('nav')?.textContent).toContain('Importa');
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
});
