import {Component, computed, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../auth/auth.service';
import {BankingService} from '../banks/banking.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MORE_ITEMS} from '../nav';
import {ThemeSwitchComponent} from '../theme/theme-switch.component';
import {IconComponent} from '../ui/icon.component';
import {PageHeaderComponent} from '../ui/page-header.component';

/** "More" on the phone: the sections that do not fit in the bar at the bottom, theme, language and log out. */
@Component({
  selector: 'app-more',
  imports: [RouterLink, TPipe, IconComponent, ThemeSwitchComponent, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.more' | t"/>
      <ul class="list">
        @for (item of items(); track item.path) {
          <li><a [routerLink]="item.path"><app-icon [name]="item.icon"/><span>{{ item.label | t }}</span>
            <app-icon class="chev" name="chevronRight"/></a></li>
        }
      </ul>
      <div class="tools">
        <div class="tool"><span id="more-theme">{{ 'theme.label' | t }}</span>
          <app-theme-switch aria-labelledby="more-theme"/></div>
        <div class="tool">
          <button type="button" [attr.lang]="i18n.other()" [attr.aria-label]="'lang.switch.label' | t"
                  (click)="i18n.setLang(i18n.other())"><app-icon name="language"/>{{ 'lang.switch' | t }}</button>
          <button type="button" (click)="logout()"><app-icon name="logout"/>{{ 'nav.logout' | t }}</button>
        </div>
      </div>
    </div>`,
  styles: [`
    .list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--radius); overflow: hidden; }
    .list li + li { border-top: 1px solid var(--line); }
    .list a { display: flex; align-items: center; gap: 12px; padding: 14px 16px; min-height: 52px; color: var(--fg);
      text-decoration: none; font-weight: 500; }
    .list a span { flex: 1; }
    .chev { color: var(--muted); }
    .tools { display: grid; gap: 12px; margin-top: 16px; }
    .tool { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
    .tool button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; min-height: 44px;
      border-radius: 8px; cursor: pointer; }
  `]
})
export class MoreComponent {
  readonly i18n = inject(I18nService);
  private banking = inject(BankingService);
  private auth = inject(AuthService);
  readonly items = computed(() => MORE_ITEMS.filter(item => !item.banking || this.banking.available()));

  logout(): void {
    this.auth.signOut();
  }
}
