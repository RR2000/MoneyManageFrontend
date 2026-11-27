import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {AuthService} from '../auth/auth.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';

/** "Forgot password": asks for the email, the answer is the same whether an account has it or not. */
@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, TPipe],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../login/login.component.css']
})
export class ForgotPasswordComponent {
  private i18n = inject(I18nService);
  email = '';
  sent = signal(false);
  busy = signal(false);
  error = signal('');

  constructor(private auth: AuthService) {
  }

  submit(): void {
    this.error.set('');
    this.busy.set(true);
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.i18n.t(err.status === 429 ? 'common.tooMany'
          : err.status === 400 ? 'forgot.invalid'
            : err.status === 404 ? 'forgot.off'
              : 'common.failed'));
      }
    });
  }
}
