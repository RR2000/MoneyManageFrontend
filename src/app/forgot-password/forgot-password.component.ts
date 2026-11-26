import {Component, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {AuthService} from '../auth/auth.service';

/** "Forgot password": asks for the email, the answer is the same whether an account has it or not. */
@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../login/login.component.css']
})
export class ForgotPasswordComponent {
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
        this.error.set(err.status === 429 ? 'Troppe richieste: riprova tra un po\'.'
          : err.status === 400 ? 'Scrivi un indirizzo email valido.'
            : err.status === 404 ? 'Il recupero della password via email non e\' attivo.'
              : 'Richiesta non riuscita, riprova.');
      }
    });
  }
}
