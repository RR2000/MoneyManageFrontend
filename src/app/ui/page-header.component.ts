import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {RouterLink} from '@angular/router';

/**
 * Title of a page, with an optional way back (crumb) and actions on the right (projected), which wrap under the
 * title on a narrow screen.
 */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  template: `
    <div class="title">
      @if (crumbLink()) {
        <nav class="crumb" [attr.aria-label]="crumbLabel()"><a [routerLink]="crumbLink()">{{ crumb() }}</a><span aria-hidden="true"> › </span></nav>
      }
      <h1>{{ title() }}</h1>
      @if (subtitle()) {
        <p class="sub">{{ subtitle() }}</p>
      }
    </div>
    <div class="actions"><ng-content/></div>`,
  styles: [`
    :host { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between;
      margin: 4px 0 16px; }
    .title { min-width: 0; }
    h1 { margin: 0; font-size: 1.5rem; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere; }
    .crumb { font-size: .82rem; color: var(--muted); }
    .sub { margin: 2px 0 0; color: var(--muted); font-size: .9rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .actions:empty { display: none; }
    @media (max-width: 839px) { h1 { font-size: 1.3rem; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  /** text and address of the page above, e.g. "Accounts" for an account */
  readonly crumb = input('');
  readonly crumbLink = input('');
  readonly crumbLabel = input('Breadcrumb');
}
