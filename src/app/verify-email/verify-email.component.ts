import {Component, OnInit, signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {AuthService, tokenFromFragment} from '../auth/auth.service';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';

/** The page of the link in the confirmation email: /verify-email#token=... */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, TPipe, IconComponent],
  templateUrl: './verify-email.component.html',
  styleUrls: ['../login/login.component.css']
})
export class VerifyEmailComponent implements OnInit {
  state = signal<'busy' | 'done' | 'broken' | 'taken' | 'failed'>('busy');

  constructor(private auth: AuthService) {
  }

  ngOnInit(): void {
    const token = tokenFromFragment(window.location.hash);
    history.replaceState(null, '', '/verify-email');
    if (!token) {
      this.state.set('broken');
      return;
    }
    this.auth.confirmEmail(token).subscribe({
      next: () => this.state.set('done'),
      error: (err: HttpErrorResponse) =>
        this.state.set(err.status === 400 ? 'broken' : err.status === 409 ? 'taken' : 'failed')
    });
  }

  loggedIn(): boolean {
    return this.auth.isLoggedIn();
  }
}
