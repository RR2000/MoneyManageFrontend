import {Component, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {AuthService, tokenFromFragment} from '../auth/auth.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';

/** The page of the link in the "forgot password" email: /reset-password#token=... */
@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink, TPipe, IconComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../login/login.component.css']
})
export class ResetPasswordComponent implements OnInit {
  private i18n = inject(I18nService);
  password = '';
  confirm = '';
  token = '';
  done = signal(false);
  busy = signal(false);
  error = signal('');
  linkBroken = signal(false);
  /** the username to log in with, from the answer */
  username = signal('');

  constructor(private auth: AuthService) {
  }

  ngOnInit(): void {
    this.token = tokenFromFragment(window.location.hash);
    // the token stays in memory only: out of the address bar and of the history
    history.replaceState(null, '', '/reset-password');
    this.linkBroken.set(!this.token);
  }

  submit(): void {
    this.error.set('');
    if (this.password.length < 8) {
      this.error.set(this.i18n.t('reset.tooShort'));
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set(this.i18n.t('reset.mismatch'));
      return;
    }
    this.busy.set(true);
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: res => {
        this.busy.set(false);
        this.username.set(res?.username ?? '');
        this.done.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const message = String(err.error?.message ?? '');
        if (err.status === 400 && message.includes('link')) {
          this.linkBroken.set(true);
        } else if (err.status === 400) {
          this.error.set(this.i18n.t('reset.invalid'));
        } else {
          this.error.set(this.i18n.t('common.failed'));
        }
      }
    });
  }
}
