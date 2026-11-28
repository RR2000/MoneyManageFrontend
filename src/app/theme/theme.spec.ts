import {TestBed} from '@angular/core/testing';
import {ThemeSwitchComponent} from './theme-switch.component';
import {applyTheme, storedTheme, ThemeService} from './theme.service';

describe('Theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('follows the system until the user picks one, then remembers it', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    theme.set('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(theme.dark()).toBe(true);
    expect(storedTheme()).toBe('dark');

    theme.set('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('a saved theme is applied before the app starts; anything else is the system', () => {
    localStorage.setItem('theme', 'light');
    applyTheme(storedTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    localStorage.setItem('theme', 'purple');
    expect(storedTheme()).toBe('system');
  });

  it('works without storage (private window)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const theme = TestBed.inject(ThemeService);
    theme.set('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    vi.restoreAllMocks();
  });

  it('the switch says which theme is on, with text and not only colour', () => {
    const fixture = TestBed.createComponent(ThemeSwitchComponent);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['System', 'Light', 'Dark']);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');

    buttons[2].click();
    fixture.detectChanges();
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
