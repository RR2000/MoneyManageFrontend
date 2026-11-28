import {Component, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {Router} from '@angular/router';
import {timeout} from 'rxjs';
import {Account, AuthService} from '../auth/auth.service';
import {I18nService, Lang} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {ThemeSwitchComponent} from '../theme/theme-switch.component';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {IconComponent} from '../ui/icon.component';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';

/**
 * /settings: the account (username, the email a forgotten password is reset with, confirmed from a link), the language
 * and the theme, and log out.
 */
@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, TPipe, ThemeSwitchComponent, PageHeaderComponent, LoadStateComponent, IconComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.settings' | t"/>

      <section class="card" aria-labelledby="settings-account">
        <h2 id="settings-account">{{ 'account.title' | t }}</h2>
        @if (state() === 'ready' && account(); as a) {
          <dl class="facts">
            <div><dt>{{ 'settings.username' | t }}</dt><dd>{{ a.username }}</dd></div>
            <div><dt>{{ 'settings.email' | t }}</dt><dd>{{ a.email || ('settings.email.none' | t) }}</dd></div>
          </dl>
          <p class="hint">{{ (a.email ? 'account.loginHint.email' : 'account.loginHint') | t }}
            @if (a.emailLinks && a.email) {
              {{ 'account.noPasswordHint' | t }}
            }
          </p>
        } @else {
          <app-load-state [state]="state()" [errorText]="'account.unavailable' | t" (retry)="load()"/>
        }
        <div class="buttons">
          <button type="button" class="btn" (click)="logout()"><app-icon name="logout"/>{{ 'nav.logout' | t }}</button>
        </div>
      </section>

      @if (state() === 'ready' && account()?.emailLinks) {
        <section class="card" aria-labelledby="settings-email">
          <h2 id="settings-email">{{ (account()?.email ? 'account.changeEmail' : 'account.addEmail') | t }}</h2>
          <p class="hint" id="settings-email-hint">{{ 'account.emailHint' | t }}</p>
          <form class="form" novalidate (ngSubmit)="submit()">
            <div class="field">
              <label for="settings-email-input">{{ 'account.emailLabel' | t }}</label>
              <input id="settings-email-input" name="email" type="email" [(ngModel)]="email" autocomplete="email"
                     aria-describedby="settings-email-hint" [attr.aria-invalid]="!!error()">
            </div>
            <div class="buttons">
              <button type="submit" class="btn primary" [disabled]="busy() || !email.trim()">
                {{ (busy() ? 'common.wait' : 'account.submit') | t }}</button>
            </div>
            <div aria-live="polite">
              @if (busy()) {
                <p class="line" role="status"><span class="spinner" aria-hidden="true"></span>{{ 'common.wait' | t }}</p>
              } @else if (sentTo()) {
                <p class="line ok" role="status"><app-icon name="ok"/><span>{{ 'account.sent' | t: {email: sentTo()} }}</span></p>
              } @else if (error()) {
                <p class="line bad" role="alert"><app-icon name="error"/><span>{{ error() }}</span></p>
              }
            </div>
          </form>
        </section>
      }

      <section class="card" aria-labelledby="settings-display">
        <h2 id="settings-display">{{ 'settings.display' | t }}</h2>
        <div class="form">
          <div class="field">
            <label for="settings-lang">{{ 'account.language' | t }}</label>
            <select id="settings-lang" name="lang" [ngModel]="i18n.lang()" (ngModelChange)="setLang($event)">
              <option value="en" lang="en">English</option>
              <option value="it" lang="it">Italiano</option>
            </select>
          </div>
          <div class="field">
            <span class="label-like" id="settings-theme">{{ 'theme.label' | t }}</span>
            <app-theme-switch aria-labelledby="settings-theme"/>
            <p class="hint">{{ 'settings.theme.hint' | t }}</p>
          </div>
        </div>
      </section>
    </div>`,
  styles: [`
    .page { display: grid; gap: 16px; }
    app-page-header { margin-bottom: 0; }
    .facts { display: grid; gap: 6px; margin: 0; }
    .facts div { display: flex; flex-wrap: wrap; gap: 4px 10px; }
    .facts dt { color: var(--muted); min-width: 7rem; }
    .facts dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
    .hint { margin: 0; font-size: .85rem; color: var(--muted); }
    .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 12px 16px;
      align-items: start; }
    .form > div:last-child:empty { display: none; }
    .field { display: grid; gap: 6px; align-content: start; min-width: 0; }
    label, .label-like { font-size: .84rem; font-weight: 600; }
    select, input { width: 100%; min-width: 0; min-height: 44px; padding: 8px 10px; font-size: 1rem; border-radius: 8px; }
    input[aria-invalid="true"] { border-color: var(--bad); border-width: 2px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
    .line { display: flex; gap: 6px; align-items: flex-start; margin: 0; overflow-wrap: anywhere; --icon-size: 16px; }
    .line.ok { color: var(--good); font-weight: 600; }
    .line.bad { color: var(--bad); font-weight: 600; }
    .spinner { display: inline-block; flex: none; width: 1em; height: 1em; border: 2px solid currentColor;
      border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
  `]
})
export class SettingsPageComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly account = signal<Account | null>(null);
  readonly state = signal<LoadState>('loading');
  email = '';
  readonly sentTo = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.auth.account().pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: a => {
        this.account.set(a);
        this.state.set('ready');
      },
      error: () => this.state.set('error')
    });
  }

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  submit(): void {
    this.error.set('');
    this.sentTo.set('');
    const email = this.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set(this.i18n.t('account.invalidEmail'));
      return;
    }
    this.busy.set(true);
    this.auth.changeEmail(email).subscribe({
      next: () => {
        this.busy.set(false);
        this.sentTo.set(email);
        this.email = '';
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.i18n.t(err.status === 429 ? 'common.tooMany'
          : err.status === 400 ? 'account.invalidEmail' : 'common.failed'));
      }
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
