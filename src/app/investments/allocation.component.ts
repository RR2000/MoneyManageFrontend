import {ChangeDetectionStrategy, Component, computed, inject, input, output, signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {IconComponent} from '../ui/icon.component';
import {gapKind, InvestmentsService, Portfolio, Slice, Target} from './investments.service';

/** the server's reasons for a refused target, in words */
const ERRORS: Record<string, MessageKey> = {
  TARGET_RANGE: 'inv.targets.error.range',
  TARGET_SUM: 'inv.targets.error.sum',
  UNKNOWN_ISIN: 'inv.targets.error.isin',
  DUPLICATE_ISIN: 'inv.targets.error.isin'
};

interface Row {
  slice: Slice;
  kind: 'buy' | 'over' | 'ok' | null;
  /** width of the bar and place of the target mark, in percent of the track */
  bar: number;
  mark: number | null;
}

/**
 * The allocation against the targets: for every position in euro a bar of its share now with a mark at its target,
 * the two percents written out and what to buy (or how much it is over) to get back to the target; a form to change
 * the targets (percent of the portfolio, together at most 100: the rest is "not assigned").
 */
@Component({
  selector: 'app-allocation',
  imports: [FormsModule, TPipe, IconComponent],
  template: `
    <div class="card-head">
      <h2>{{ 'inv.allocation' | t }}</h2>
      @if (!editing() && rows().length) {
        <button type="button" class="btn" (click)="edit()"><app-icon name="edit"/>{{ 'inv.targets.edit' | t }}</button>
      }
    </div>
    @if (saved()) {
      <p class="ok-line" role="status"><app-icon name="ok"/><span>{{ 'inv.targets.saved' | t }}</span></p>
    }
    @if (editing()) {
      <form class="form" (ngSubmit)="save()">
        <p class="small muted">{{ 'inv.targets.help' | t }}</p>
        @for (row of rows(); track row.slice.isin) {
          <label class="field">
            <span class="name">{{ row.slice.name || row.slice.isin }}</span>
            <span class="input"><input type="number" inputmode="decimal" min="0" max="100" step="0.01"
                                       [name]="row.slice.isin" [(ngModel)]="draft[row.slice.isin]" (ngModelChange)="touch()"
                                       [attr.aria-describedby]="'sum-' + uid"><span aria-hidden="true">%</span></span>
          </label>
        }
        <p class="sum" [id]="'sum-' + uid" [class.bad]="draftSum() > 100" aria-live="polite">
          @if (draftSum() > 100) {
            <app-icon name="warn"/>
          }
          <span>{{ 'inv.targets.sum' | t: {assigned: pct(draftSum()), free: pct(100 - draftSum())} }}</span>
        </p>
        @if (error()) {
          <p class="error" role="alert"><app-icon name="error"/><span>{{ error() }}</span></p>
        }
        <div class="buttons">
          <button type="submit" class="btn primary" [disabled]="busy() || draftSum() > 100 || invalid()">
            {{ (busy() ? 'common.wait' : 'common.save') | t }}</button>
          <button type="button" class="btn" (click)="cancel()" [disabled]="busy()">{{ 'common.cancel' | t }}</button>
        </div>
      </form>
    } @else if (rows().length) {
      <ul class="bars">
        @for (row of rows(); track row.slice.isin) {
          <li>
            <div class="top">
              <span class="name">{{ row.slice.name || row.slice.isin }}</span>
              <span class="nums">{{ 'inv.alloc.now' | t: {share: pct(row.slice.actualPercent)} }}@if (row.slice.targetPercent !== null) {
                · {{ 'inv.alloc.target' | t: {share: pct(row.slice.targetPercent)} }}}</span>
            </div>
            <span class="track" aria-hidden="true">
              <i class="fill" [style.width.%]="row.bar"></i>
              @if (row.mark !== null) {
                <i class="mark" [style.left.%]="row.mark"></i>
              }
            </span>
            <span class="gap" [class]="row.kind ?? 'none'">
              @switch (row.kind) {
                @case ('buy') {
                  <app-icon name="plus"/>{{ 'inv.alloc.buy' | t: {amount: money(row.slice.gap!)} }}
                }
                @case ('over') {
                  <app-icon name="up"/>{{ 'inv.alloc.over' | t: {amount: money(-row.slice.gap!)} }}
                }
                @case ('ok') {
                  <app-icon name="ok"/>{{ 'inv.alloc.ok' | t }}
                }
                @default {
                  {{ 'inv.alloc.noTarget' | t }}
                }
              }
            </span>
          </li>
        }
      </ul>
      <p class="small muted">
        @if (portfolio().allocation.assignedPercent > 0) {
          {{ 'inv.alloc.unassigned' | t: {share: pct(portfolio().allocation.unassignedPercent)} }}
          {{ 'inv.alloc.legend' | t }}
        } @else {
          {{ 'inv.alloc.none' | t }}
        }
      </p>
    } @else {
      <p class="small muted">{{ 'inv.alloc.empty' | t }}</p>
    }`,
  styles: [`
    :host { display: grid; gap: 12px; min-width: 0; }
    .small { font-size: .85rem; margin: 0; }
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
    .bars li { display: grid; gap: 5px; min-width: 0; }
    .top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; font-size: .9rem; }
    .name { font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
    .nums { color: var(--fg); font-variant-numeric: tabular-nums; }
    .track { position: relative; display: block; height: 12px; background: var(--surface-2); border-radius: 0 4px 4px 0;
      border: 1px solid var(--line); }
    .fill { display: block; height: 100%; background: var(--s1); border-radius: 0 4px 4px 0; }
    .mark { position: absolute; top: -4px; bottom: -4px; width: 3px; margin-left: -1.5px; background: var(--fg);
      border-radius: 2px; }
    .gap { display: inline-flex; align-items: center; gap: 5px; font-size: .84rem; color: var(--muted); --icon-size: 14px; }
    .gap.buy { color: var(--accent); font-weight: 600; }
    .gap.over { color: var(--warn); font-weight: 600; }
    .gap.ok { color: var(--good); font-weight: 600; }
    .form { display: grid; gap: 10px; }
    .field { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
    .input { display: inline-flex; align-items: center; gap: 6px; }
    .input input { width: 6.5rem; padding: 7px 8px; text-align: right; min-height: 40px; }
    .sum { display: flex; gap: 6px; align-items: center; margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
    .sum.bad { color: var(--bad); }
    .error { display: flex; gap: 6px; align-items: center; margin: 0; }
    .ok-line { display: flex; gap: 6px; align-items: center; margin: 0; color: var(--good); font-weight: 600; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllocationComponent {
  readonly portfolio = input.required<Portfolio>();
  /** the targets changed: the page reads the portfolio again */
  readonly changed = output<void>();
  private readonly i18n = inject(I18nService);
  private readonly service = inject(InvestmentsService);
  readonly uid = Math.random().toString(36).slice(2, 8);

  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  /** percents being edited, by ISIN (null or '' = no target) */
  draft: Record<string, number | null> = {};
  private readonly version = signal(0);

  readonly rows = computed<Row[]>(() => {
    const p = this.portfolio();
    const slices = p.allocation.slices;
    // the track is as wide as the largest share, now or wanted, so small positions can still be seen
    const max = Math.max(1, ...slices.map(s => Math.max(s.actualPercent, s.targetPercent ?? 0)));
    return slices.map(slice => ({
      slice,
      kind: gapKind(slice.gap, p.totals.value),
      bar: slice.actualPercent / max * 100,
      mark: slice.targetPercent === null ? null : slice.targetPercent / max * 100
    }));
  });

  readonly draftSum = computed(() => {
    this.version();
    return round2(Object.values(this.draft).reduce<number>((sum, v) => sum + (isNum(v) ? Number(v) : 0), 0));
  });

  readonly invalid = computed(() => {
    this.version();
    return Object.values(this.draft).some(v => isNum(v) && (Number(v) < 0 || Number(v) > 100));
  });

  pct(value: number): string {
    return this.i18n.percent(value / 100, 2);
  }

  money(value: number): string {
    return this.i18n.money(value, this.portfolio().currency, 0);
  }

  edit(): void {
    this.draft = {};
    for (const row of this.rows()) {
      this.draft[row.slice.isin] = row.slice.targetPercent;
    }
    this.error.set('');
    this.saved.set(false);
    this.editing.set(true);
    this.touch();
  }

  touch(): void {
    this.version.update(v => v + 1);
  }

  cancel(): void {
    this.editing.set(false);
    this.error.set('');
  }

  save(): void {
    if (this.draftSum() > 100 || this.invalid()) {
      return;
    }
    const shown = new Set(this.rows().map(r => r.slice.isin));
    const targets: Target[] = Object.entries(this.draft)
      .filter(([, v]) => isNum(v) && Number(v) > 0)
      .map(([isin, v]) => ({isin, percent: round2(Number(v))}));
    // targets of positions not in the allocation (another currency) stay as they are
    for (const p of this.portfolio().positions) {
      if (!shown.has(p.isin) && p.targetPercent !== null) {
        targets.push({isin: p.isin, percent: p.targetPercent});
      }
    }
    this.busy.set(true);
    this.error.set('');
    this.service.saveTargets(targets).subscribe({
      next: () => {
        this.busy.set(false);
        this.editing.set(false);
        this.saved.set(true);
        this.changed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const key = ERRORS[err.error?.message as string];
        this.error.set(err.status === 0 ? this.i18n.t('common.unreachable')
          : key ? this.i18n.t(key) : this.i18n.t('common.failed'));
      }
    });
  }
}

function isNum(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
