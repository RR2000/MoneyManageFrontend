import {Component, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Router, RouterLink} from '@angular/router';
import {AuthService, loginReturn, Providers} from '../auth/auth.service';
import {I18nService} from '../i18n/i18n.service';
import {MessageKey} from '../i18n/messages.en';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';

/** The codes of /login#oidc-error=code (the backend's OidcAccounts and SecurityConfig) and their texts. */
const OIDC_ERRORS: Record<string, MessageKey> = {
  'email-unverified': 'login.oidcError.email-unverified',
  'email-unconfirmed': 'login.oidcError.email-unconfirmed',
  'already-linked': 'login.oidcError.already-linked',
  'unavailable': 'login.oidcError.unavailable',
  'failed': 'login.oidcError.failed'
};

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, TPipe, IconComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private i18n = inject(I18nService);
  mode: 'login' | 'register' = 'login';
  username = '';
  password = '';
  email = '';
  sampleData = true;
  error = signal('');
  busy = signal(false);
  githubUrl = signal('');
  /** "forgot password" by email: shown only when the server can send mail */
  passwordReset = signal(false);
  /** username and password: off when the server offers only raoulrondinella.dev (AUTH_MODE=oidc) */
  passwordLogin = signal(true);
  /** "Continue with raoulrondinella.dev", the single sign-on of the site */
  oidcUrl = signal('');
  /** why the last login with raoulrondinella.dev did not work, shown next to its button */
  oidcError = signal('');

  constructor(private auth: AuthService, private router: Router, private http: HttpClient) {
  }

  ngOnInit(): void {
    // back from GitHub or raoulrondinella.dev: the backend puts the token (or the error) in the fragment
    const back = loginReturn(window.location.hash);
    if (back.token) {
      this.auth.acceptToken(back.token, back.idToken);
      history.replaceState(null, '', '/login');
      this.router.navigate(['/']);
      return;
    }
    if (back.error === 'github-error') {
      history.replaceState(null, '', '/login');
      this.error.set(this.i18n.t('login.githubError'));
    }
    if (back.oidcError !== undefined) {
      history.replaceState(null, '', '/login');
      this.oidcError.set(this.i18n.t(OIDC_ERRORS[back.oidcError] ?? 'login.oidcError.failed'));
    }
    this.http.get<Providers>('/api/auth/providers').subscribe({
      next: p => {
        this.passwordLogin.set(p.password !== false);
        this.githubUrl.set(p.github && p.githubUrl ? p.githubUrl : '');
        this.passwordReset.set(!!p.passwordReset);
        this.oidcUrl.set(p.oidc && p.oidcUrl ? p.oidcUrl : '');
      },
      error: () => this.githubUrl.set('')
    });
  }

  submit(): void {
    this.error.set('');
    this.busy.set(true);
    const call = this.mode === 'login'
      ? this.auth.login(this.username, this.password)
      : this.auth.register(this.username, this.password, this.sampleData,
        this.passwordReset() ? this.email.trim() : '');
    call.subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        if (err.status === 429) {
          this.error.set(this.i18n.t('login.tooMany'));
          return;
        }
        if (err.status === 0 || err.status >= 500) {
          // not a wrong password: the server is down or unreachable
          this.error.set(this.i18n.t('common.unreachable'));
          return;
        }
        // the server's reason for a refused sign-up (username taken...) is shown as it comes
        this.error.set(this.mode === 'login'
          ? this.i18n.t('login.failed')
          : this.i18n.t('login.register.failed', {message: err.error?.message ?? err.statusText}));
      }
    });
  }

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error.set('');
  }
}
