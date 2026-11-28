import {Component} from '@angular/core';
import {MonteCarloComponent} from '../monte-carlo/monte-carlo.component';
import {TPipe} from '../i18n/t.pipe';

/** /plan: the Monte Carlo projection for now; the plan with scenarios and payments comes next. */
@Component({
  selector: 'app-plan-page',
  imports: [MonteCarloComponent, TPipe],
  template: `
    <div class="page">
      <h1>{{ 'nav.plan' | t }}</h1>
      <app-monte-carlo></app-monte-carlo>
    </div>`,
  styles: ['h1 { font-size: 1.5rem; margin: 4px 0 4px; }']
})
export class PlanPageComponent {
}
