import {Component, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Router} from '@angular/router';
import {AuthService} from '../auth/auth.service';

interface Providers {
  github: boolean;
  githubUrl?: string;
}

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  mode: 'login' | 'register' = 'login';
  username = '';
  password = '';
  sampleData = true;
  error = signal('');
  busy = signal(false);
  githubUrl = signal('');

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
      next: p => this.githubUrl.set(p.github && p.githubUrl ? p.githubUrl : ''),
      error: () => this.githubUrl.set('')
    });
  }

  submit(): void {
    this.error.set('');
    this.busy.set(true);
    const call = this.mode === 'login'
      ? this.auth.login(this.username, this.password)
      : this.auth.register(this.username, this.password, this.sampleData);
    call.subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        if (err.status === 429) {
          this.error.set('Troppi tentativi: riprova tra qualche minuto.');
          return;
        }
        this.error.set(this.mode === 'login'
          ? 'Accesso non riuscito: username o password errati'
          : `Registrazione non riuscita: ${err.error?.message ?? err.statusText}`);
      }
    });
  }

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error.set('');
  }
}
