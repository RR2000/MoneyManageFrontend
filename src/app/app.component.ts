import {Component, inject} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs';
import {AuthService} from './auth/auth.service';
import {BankingService} from './banks/banking.service';
import {TPipe} from './i18n/t.pipe';
import {I18nService} from './i18n/i18n.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe],
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  readonly i18n = inject(I18nService);
  private banking = inject(BankingService);
  /** "Banks" only when the server has the feature for this user (no 404) */
  readonly banksAvailable = this.banking.available;

  constructor(private auth: AuthService, private router: Router) {
    // after every navigation, so a login (or another user) is checked too; once per login
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.banking.checkAvailability());
  }

  isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
