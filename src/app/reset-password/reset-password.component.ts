import {Component, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {AuthService, tokenFromFragment} from '../auth/auth.service';

/** The page of the link in the "forgot password" email: /reset-password#token=... */
@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../login/login.component.css']
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirm = '';
  token = '';
  done = signal(false);
  busy = signal(false);
  error = signal('');
  linkBroken = signal(false);

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
      this.error.set('La password deve avere almeno 8 caratteri.');
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Le due password non coincidono.');
      return;
    }
    this.busy.set(true);
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.busy.set(false);
        this.done.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const message = String(err.error?.message ?? '');
        if (err.status === 400 && message.includes('link')) {
          this.linkBroken.set(true);
        } else if (err.status === 400) {
          this.error.set('Password non valida: almeno 8 caratteri, al massimo 72 byte.');
        } else {
          this.error.set('Richiesta non riuscita, riprova.');
        }
      }
    });
  }
}
