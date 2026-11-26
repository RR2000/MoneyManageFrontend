import {Component, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {Account, AuthService} from '../auth/auth.service';

/** The account: username and the email a forgotten password is reset with (confirmed from a link). */
@Component({
  selector: 'app-account',
  imports: [FormsModule],
  templateUrl: './account.component.html',
  styleUrls: ['../login/login.component.css']
})
export class AccountComponent implements OnInit {
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
      error: () => this.error.set('Account non disponibile, riprova.')
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
        this.error.set(err.status === 429 ? 'Troppe richieste: riprova tra un po\'.'
          : err.status === 400 ? 'Scrivi un indirizzo email valido.'
            : 'Richiesta non riuscita, riprova.');
      }
    });
  }
}
