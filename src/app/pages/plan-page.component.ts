import {Component} from '@angular/core';
import {MonteCarloComponent} from '../monte-carlo/monte-carlo.component';
import {PageHeaderComponent} from '../ui/page-header.component';
import {TPipe} from '../i18n/t.pipe';

/** /plan: the Monte Carlo projection for now; the plan with scenarios and payments comes next. */
@Component({
  selector: 'app-plan-page',
  imports: [PageHeaderComponent, MonteCarloComponent, TPipe],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.plan' | t"/>
      <app-monte-carlo></app-monte-carlo>
    </div>`
})
export class PlanPageComponent {
}
