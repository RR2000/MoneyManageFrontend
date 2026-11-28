import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TPipe} from '../i18n/t.pipe';
import {PageHeaderComponent} from '../ui/page-header.component';
import {IconComponent} from '../ui/icon.component';
import {MovementsComponent} from '../accounts/movements.component';

/**
 * /costs/uncategorized: the movements of every account that have no category yet, newest first, each with the way to
 * give it one (and a rule for the ones like it). Where "N movements without a category - Assign" leads.
 */
@Component({
  selector: 'app-uncategorized-page',
  imports: [RouterLink, TPipe, PageHeaderComponent, IconComponent, MovementsComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'costs.uncategorized.title' | t" [subtitle]="'costs.uncategorized.subtitle' | t"
                       [crumb]="'nav.costs' | t" crumbLink="/costs" [crumbLabel]="'nav.back' | t">
        <a class="btn" routerLink="/costs/rules"><app-icon name="tag"/>{{ 'costs.rules' | t }}</a>
      </app-page-header>
      <section class="card" [attr.aria-label]="'costs.uncategorized.title' | t">
        <app-movements accountId="" [startUncategorized]="true"/>
      </section>
    </div>`,
  styles: [`.page { display: grid; gap: 16px; } app-page-header { margin-bottom: 0; }`]
})
export class UncategorizedPageComponent {
}
