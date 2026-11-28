import {Component, computed, inject, signal} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs';
import {AuthService} from './auth/auth.service';
import {BankingService} from './banks/banking.service';
import {TPipe} from './i18n/t.pipe';
import {I18nService} from './i18n/i18n.service';
import {ThemeSwitchComponent} from './theme/theme-switch.component';
import {IconComponent} from './ui/icon.component';
import {BOTTOM_ITEMS, FOOT_ITEMS, MORE_ITEMS, SIDE_ITEMS} from './nav';

/**
 * The frame of the app: a side bar on a wide screen, a bar at the bottom on a phone (the same links, chosen by CSS),
 * one address per section. Pages scroll with the document: one vertical scroll, never a horizontal one.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe, ThemeSwitchComponent, IconComponent],
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  readonly i18n = inject(I18nService);
  private banking = inject(BankingService);
  /** "Banks" only when the server has the feature for this user (no 404) */
  readonly banksAvailable = this.banking.available;
  readonly sideItems = computed(() => SIDE_ITEMS.filter(item => !item.banking || this.banksAvailable()));
  readonly footItems = FOOT_ITEMS;
  readonly bottomItems = BOTTOM_ITEMS;
  private readonly url = signal('/');
  /** a section reached from "More" is the current page of "More" in the bar at the bottom */
  private readonly path = computed(() => this.url().split(/[?#]/)[0]);
  private readonly inMore = computed(() =>
    MORE_ITEMS.some(item => this.path() === item.path || this.path().startsWith(item.path + '/')));

  /** the entry of the bar at the bottom for the page on screen; "More" also for the sections it lists */
  bottomActive(path: string): boolean {
    const current = this.path();
    if (path === '/') {
      return current === '/';
    }
    if (path === '/more') {
      return current === '/more' || this.inMore();
    }
    return current === path || current.startsWith(path + '/');
  }

  constructor(private auth: AuthService, private router: Router) {
    // after every navigation, so a login (or another user) is checked too; once per login
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      this.url.set((e as NavigationEnd).urlAfterRedirects);
      this.banking.checkAvailability();
    });
  }

  isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
