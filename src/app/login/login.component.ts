import {Component, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Router, RouterLink} from '@angular/router';
import {AuthService, Providers} from '../auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
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

  constructor(private auth: AuthService, private router: Router, private http: HttpClient) {
  }

  ngOnInit(): void {
    // back from "Accedi con GitHub": the backend puts the token (or the error) in the fragment
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      this.auth.acceptToken(decodeURIComponent(hash.substring('#token='.length)));
      history.replaceState(null, '', '/login');
      this.router.navigate(['/']);
      return;
    }
    if (hash === '#github-error') {
      history.replaceState(null, '', '/login');
      this.error.set('Accesso con GitHub non riuscito: serve un account GitHub con un\'email verificata.');
    }
    this.http.get<Providers>('/api/auth/providers').subscribe({
      next: p => {
        this.githubUrl.set(p.github && p.githubUrl ? p.githubUrl : '');
        this.passwordReset.set(!!p.passwordReset);
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
          this.error.set('Troppi tentativi: riprova tra qualche minuto.');
          return;
        }
        if (err.status === 0 || err.status >= 500) {
          // not a wrong password: the server is down or unreachable
          this.error.set('Server non raggiungibile, riprova tra poco.');
          return;
        }
        this.error.set(this.mode === 'login'
          ? 'Accesso non riuscito: username (o email) o password errati'
          : `Registrazione non riuscita: ${err.error?.message ?? err.statusText}`);
      }
    });
  }

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error.set('');
  }
}
