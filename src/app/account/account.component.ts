import {Component, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {Account, AuthService} from '../auth/auth.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';

/** The account: username and the email a forgotten password is reset with (confirmed from a link). */
@Component({
  selector: 'app-account',
  imports: [FormsModule, TPipe],
  templateUrl: './account.component.html',
  styleUrls: ['../login/login.component.css']
})
export class AccountComponent implements OnInit {
  readonly i18n = inject(I18nService);
  account = signal<Account | null>(null);
  email = '';
  sentTo = signal('');
  busy = signal(false);
  error = signal('');

  constructor(private auth: AuthService) {
  }

  ngOnInit(): void {
    this.auth.account().subscribe({
      next: a => this.account.set(a),
      error: () => this.error.set(this.i18n.t('account.unavailable'))
    });
  }

  submit(): void {
    this.error.set('');
    this.sentTo.set('');
    const email = this.email.trim();
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
}
