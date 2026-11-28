import {ChangeDetectionStrategy, Component, inject, input, output, signal} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';
import {PlanView, VersionSummary} from './plan.service';

/**
 * The saved versions of a plan, newest first (the first is in use): each can be opened; and "Delete the plan", with a
 * confirmation in the card.
 */
@Component({
  selector: 'app-plan-versions',
  imports: [TPipe, IconComponent],
  template: `
    <h2 id="plan-versions">{{ 'plan.versions' | t }}</h2>
    <ul class="versions">
      @for (v of plan().versions; track v.number; let first = $first) {
        <li [class.current]="v.number === plan().version.number">
          <span class="name">{{ 'plan.version.n' | t: {number: v.number} }}
            <span class="when">{{ 'plan.version.saved' | t: {date: i18n.date(v.savedOn)} }}</span></span>
          <span class="acts">
            @if (first) {<span class="chip good"><app-icon name="ok"/>{{ 'plan.version.inUse' | t }}</span>}
            @if (v.number === plan().version.number) {
              <span class="chip"><app-icon name="info"/>{{ 'plan.version.showing' | t }}</span>
            } @else {
              <button type="button" class="btn small" (click)="open.emit(first ? null : v.number)" [disabled]="loading() !== null">
                {{ (loading() === (first ? 0 : v.number) ? 'common.wait' : 'plan.version.open') | t }}<span
                  class="sr-only"> {{ 'plan.version.n' | t: {number: v.number} }}</span></button>
            }
          </span>
          <span class="meta">{{ meta(v) }}</span>
        </li>
      }
    </ul>
    @if (confirming()) {
      <div class="confirm" role="group" [attr.aria-label]="'plan.delete' | t">
        <span class="q"><app-icon name="warn"/>{{ (plan().versions.length === 1 ? 'plan.delete.confirm.one' : 'plan.delete.confirm') | t: {name: plan().name, count: plan().versions.length} }}</span>
        <span class="btns">
          <button type="button" class="btn danger" (click)="remove.emit()" [disabled]="deleting()">
            <app-icon name="trash"/>{{ (deleting() ? 'common.wait' : 'plan.delete.yes') | t }}</button>
          <button type="button" class="btn" (click)="confirming.set(false)" [disabled]="deleting()">{{ 'common.cancel' | t }}</button>
        </span>
        @if (deleteError()) {<p class="err" role="alert"><app-icon name="error"/><span>{{ 'common.failed' | t }}</span></p>}
      </div>
    } @else {
      <button type="button" class="btn danger delete" (click)="confirming.set(true)"><app-icon name="trash"/>{{ 'plan.delete' | t }}</button>
    }`,
  styles: [`
    :host { display: grid; gap: 12px; }
    h2 { margin: 0; font-size: 1rem; font-weight: 700; }
    .versions { list-style: none; margin: 0; padding: 0; }
    .versions li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 10px 0;
      border-bottom: 1px solid var(--line); align-items: center; }
    .versions li:last-child { border-bottom: 0; }
    .name { font-weight: 700; }
    .when { font-weight: 400; color: var(--muted); margin-left: 6px; font-size: .88rem; }
    li.current .name { color: var(--accent); }
    .acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; align-items: center; }
    .meta { grid-column: 1 / -1; font-size: .82rem; color: var(--muted); overflow-wrap: anywhere; }
    .btn.small { min-height: 36px; padding: 4px 12px; font-size: .84rem; --icon-size: 15px; }
    .delete { justify-self: start; }
    .confirm { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 10px;
      background: var(--warn-bg); }
    .q { display: flex; gap: 6px; align-items: center; font-weight: 600; flex: 1 1 14rem; min-width: 0;
      overflow-wrap: anywhere; --icon-size: 16px; }
    .q app-icon { color: var(--warn); }
    .btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .confirm .btn.danger { background: var(--surface); }
    .err { flex-basis: 100%; display: flex; gap: 6px; align-items: center; margin: 0; color: var(--bad); font-weight: 600; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanVersionsComponent {
  readonly plan = input.required<PlanView>();
  /** the version being opened (0: the one in use), null when none */
  readonly loading = input<number | null>(null);
  readonly deleting = input(false);
  readonly deleteError = input(false);
  readonly currency = input('EUR');
  /** a version (null: the one in use) */
  readonly open = output<number | null>();
  readonly remove = output<void>();
  readonly confirming = signal(false);
  readonly i18n = inject(I18nService);

  meta(v: VersionSummary): string {
    const events = v.events === 0 ? '' : ' · ' + this.i18n.t(v.events === 1 ? 'plan.version.events.one'
      : 'plan.version.events', {count: v.events});
    return this.i18n.t('plan.version.meta', {date: this.i18n.date(v.targetDate),
      monthly: this.i18n.money(v.monthly, this.currency(), 0), rate: this.i18n.percent(v.rateBase / 100, 2)}) + events;
  }
}
