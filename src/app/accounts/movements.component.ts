import {Component, computed, effect, inject, input, OnDestroy, signal, untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {AccountsService, Movement, MovementKind} from './accounts.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {AmountComponent} from '../ui/amount.component';
import {IconComponent} from '../ui/icon.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {SourceTagComponent} from '../ui/source-tag.component';
import {AssignComponent} from '../costs/assign.component';
import {Applied, Assigned, CostsService} from '../costs/costs.service';

export const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;

const KINDS: { kind: MovementKind; label: MessageKey }[] = [
  {kind: 'ALL', label: 'movements.all'},
  {kind: 'IN', label: 'movements.in'},
  {kind: 'OUT', label: 'movements.out'}
];

/**
 * The movements of an account (or of every account, `accountId` empty) as a list by day, newest first (on a phone
 * too: never a table with a column per account): search by words or amount, money in or out, only the ones without a
 * category, where each row comes from, its category (a button: choose it by hand, optionally with a rule) and
 * "Load 50 more". After a rule from a row, "apply to all" is offered with the number of movements it changes.
 */
@Component({
  selector: 'app-movements',
  imports: [RouterLink, TPipe, AmountComponent, IconComponent, LoadStateComponent, SourceTagComponent, AssignComponent],
  template: `
    <div class="search">
      <label class="box">
        <span class="sr-only">{{ 'movements.search' | t }}</span>
        <app-icon name="search"/>
        <input type="search" [value]="query()" (input)="typed($any($event.target).value)"
               [attr.placeholder]="'movements.search' | t" autocomplete="off" enterkeyhint="search">
      </label>
      <div class="ranges" role="group" [attr.aria-label]="'movements.filter' | t">
        @for (k of kinds; track k.kind) {
          <button type="button" [attr.aria-pressed]="kind() === k.kind" (click)="setKind(k.kind)">{{ k.label | t }}</button>
        }
      </div>
      <div class="ranges">
        <button type="button" [attr.aria-pressed]="uncategorized()" (click)="toggleUncategorized()">
          {{ 'movements.uncategorized' | t }}</button>
      </div>
    </div>
    <p class="status" role="status" aria-live="polite">
      @if (status()) {
        <app-icon name="ok"/><span>{{ status() }}</span>
      }
    </p>
    @if (offer(); as o) {
      <div class="offer" role="group" [attr.aria-label]="'movements.offer.label' | t">
        <app-icon name="info"/>
        <span class="q">{{ offerText(o) }}</span>
        <span class="btns">
          <button type="button" class="btn primary" (click)="applyAll()" [disabled]="applying()">
            {{ (applying() ? 'common.wait' : 'movements.offer.apply') | t: {count: o.total} }}</button>
          <button type="button" class="btn" (click)="offer.set(null)" [disabled]="applying()">{{ 'movements.offer.no' | t }}</button>
        </span>
        @if (applyError()) {
          <p class="err" role="alert"><app-icon name="error"/><span>{{ 'common.failed' | t }}</span></p>
        }
      </div>
    }
    @if (state() === 'ready') {
      <ul class="rows" [attr.aria-busy]="loadingMore()">
        @for (day of days(); track day.key) {
          <li class="day" role="presentation">{{ day.label }}</li>
          @for (m of day.items; track m.id) {
            <li class="row">
              <span class="d">{{ m.description }}</span>
              <app-amount class="amt" [value]="m.amount" [currency]="m.currency || currency()" [signed]="true"/>
              <span class="m">
                @if (!accountId() && m.accountId) {
                  <a class="acc" [routerLink]="['/accounts', m.accountId]">{{ m.account }}</a>
                }
                <app-source-tag [source]="m.source"/>
                <button type="button" class="cat" [class.none]="!m.category" [attr.aria-expanded]="open() === m.id"
                        (click)="toggle(m.id)">
                  <app-icon name="tag"/>
                  @if (m.category) {
                    <span><span class="sr-only">{{ 'costs.field.category' | t }}: </span>{{ m.category }}</span>
                    @if (m.categorySource === 'MANUAL') {<span class="by">{{ 'movements.byHand' | t }}</span>}
                  } @else {
                    <span>{{ 'movements.noCategory' | t }}</span>
                  }
                  <span class="sr-only"> - {{ 'movements.change' | t }} {{ m.description }}</span>
                </button>
              </span>
              @if (open() === m.id) {
                <app-assign [target]="{id: m.id, description: m.description, amount: m.amount, categoryId: m.categoryId ?? null}"
                            (saved)="assigned(m, $event)" (cancelled)="open.set(null)"/>
              }
            </li>
          }
        }
      </ul>
      @if (moreError()) {
        <app-load-state state="error" (retry)="loadMore()"/>
      }
      @if (hasMore()) {
        <button type="button" class="btn more" (click)="loadMore()" [disabled]="loadingMore()">
          {{ (loadingMore() ? 'common.loading' : 'movements.more') | t: {count: pageSize} }}
        </button>
      }
      @if (loadingMore()) {
        <app-load-state state="loading"/>
      }
    } @else {
      <app-load-state [state]="state()" [emptyText]="emptyText() | t" (retry)="reload()"/>
    }`,
  styles: [`
    :host { display: grid; gap: 12px; min-width: 0; }
    .search { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .box { flex: 1 1 220px; display: flex; align-items: center; gap: 8px; padding: 0 10px; min-height: 40px;
      background: var(--surface); border: 1px solid var(--line-strong); border-radius: 8px; color: var(--muted);
      --icon-size: 16px; }
    .box:focus-within { outline: 3px solid var(--accent); outline-offset: 2px; }
    .box input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; padding: 8px 0;
      color: var(--fg); font-size: 16px; }
    .status { display: flex; gap: 6px; align-items: center; margin: 0; color: var(--good); font-weight: 600; --icon-size: 18px; }
    .status:empty { display: none; }
    .offer { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; padding: 10px 12px; border-radius: 10px;
      background: var(--accent-soft); --icon-size: 18px; }
    .offer > app-icon { color: var(--accent); }
    .offer .q { flex: 1 1 14rem; min-width: 0; font-weight: 600; }
    .offer .btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .offer .err { flex-basis: 100%; display: flex; gap: 6px; margin: 0; color: var(--bad); font-weight: 600; }
    .rows { list-style: none; margin: 0; padding: 0; }
    .day { font-size: .76rem; font-weight: 700; color: var(--muted); padding: 14px 0 4px; letter-spacing: .04em;
      text-transform: uppercase; border-bottom: 1px solid var(--line); }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 9px 0;
      border-bottom: 1px solid var(--line); align-items: center; }
    .d { font-weight: 500; overflow-wrap: anywhere; }
    .amt { font-weight: 600; text-align: right; grid-row: 1 / span 2; grid-column: 2; }
    .m { grid-column: 1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
    .acc { font-size: .8rem; color: var(--muted); overflow-wrap: anywhere; }
    .cat { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 2px 10px; border-radius: 999px;
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--fg); font-size: .78rem;
      cursor: pointer; max-width: 100%; text-align: left; --icon-size: 13px; }
    .cat > span { overflow-wrap: anywhere; }
    .cat.none { border-style: dashed; color: var(--muted); }
    .cat[aria-expanded="true"] { border-color: var(--accent); color: var(--accent); }
    .cat .by { color: var(--muted); }
    .cat .by::before { content: '· '; }
    .more { justify-self: center; }
  `]
})
export class MovementsComponent implements OnDestroy {
  /** id of the account (its page); empty: every account */
  readonly accountId = input.required<string>();
  readonly currency = input('EUR');
  /** start with only the movements without a category */
  readonly startUncategorized = input(false);
  readonly pageSize = PAGE_SIZE;
  readonly kinds = KINDS;

  private service = inject(AccountsService);
  private costs = inject(CostsService);
  private i18n = inject(I18nService);

  readonly query = signal('');
  readonly kind = signal<MovementKind>('ALL');
  readonly uncategorized = signal(false);
  readonly items = signal<Movement[]>([]);
  readonly hasMore = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly loadingMore = signal(false);
  readonly moreError = signal(false);
  /** the row whose category is being chosen */
  readonly open = signal<number | null>(null);
  readonly status = signal('');
  /** after a new rule: what "apply to all" would change */
  readonly offer = signal<Applied | null>(null);
  readonly applying = signal(false);
  readonly applyError = signal(false);
  private timer?: ReturnType<typeof setTimeout>;
  private call?: Subscription;

  readonly emptyText = computed<MessageKey>(() => this.uncategorized() && !this.query() && this.kind() === 'ALL'
    ? 'movements.allCategorized' : this.query() || this.kind() !== 'ALL' || this.uncategorized() ? 'movements.noMatch'
      : 'movements.none');

  readonly days = computed(() => {
    this.i18n.lang();
    const groups: { key: string; label: string; items: Movement[] }[] = [];
    for (const m of this.items()) {
      const key = m.datetime.substring(0, 10);
      let group = groups.at(-1);
      if (!group || group.key !== key) {
        group = {key, label: this.i18n.dayHeading(key), items: []};
        groups.push(group);
      }
      group.items.push(m);
    }
    return groups;
  });

  constructor() {
    effect(() => {
      this.accountId();
      const start = this.startUncategorized();
      untracked(() => {
        this.uncategorized.set(start);
        this.reload();
      });
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.call?.unsubscribe();
  }

  typed(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.reload(), SEARCH_DELAY_MS);
  }

  setKind(kind: MovementKind): void {
    this.kind.set(kind);
    this.reload();
  }

  toggleUncategorized(): void {
    this.uncategorized.update(on => !on);
    this.reload();
  }

  toggle(id: number): void {
    this.open.update(open => open === id ? null : id);
    this.status.set('');
  }

  private queryOf(offset: number) {
    return {q: this.query().trim(), kind: this.kind(), uncategorized: this.uncategorized(), offset, limit: PAGE_SIZE};
  }

  reload(): void {
    this.call?.unsubscribe();
    this.state.set('loading');
    this.moreError.set(false);
    this.open.set(null);
    this.call = this.service.movements(this.accountId(), this.queryOf(0)).subscribe({
      next: page => {
        this.items.set(page.items);
        this.hasMore.set(page.hasMore);
        this.state.set(page.items.length ? 'ready' : 'empty');
      },
      error: () => this.state.set('error')
    });
  }

  loadMore(): void {
    this.loadingMore.set(true);
    this.moreError.set(false);
    this.call = this.service.movements(this.accountId(), this.queryOf(this.items().length)).subscribe({
      next: page => {
        this.items.update(list => [...list, ...page.items]);
        this.hasMore.set(page.hasMore);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingMore.set(false);
        this.moreError.set(true);
      }
    });
  }

  /** the row changes at once; in the list of the ones without a category it goes away */
  assigned(m: Movement, result: Assigned): void {
    this.open.set(null);
    const changed: Movement = {...m, categoryId: result.categoryId, category: result.category,
      categorySource: result.categorySource};
    this.items.update(list => this.uncategorized() && result.categoryId !== null ? list.filter(x => x.id !== m.id)
      : list.map(x => x.id === m.id ? changed : x));
    if (!this.items().length) {
      this.state.set('empty');
    }
    this.status.set(result.category ? this.i18n.t('movements.saved', {category: result.category})
      : this.i18n.t('movements.cleared'));
    this.offer.set(result.preview && result.preview.total > 0 ? result.preview : null);
    this.applyError.set(false);
  }

  offerText(o: Applied): string {
    return o.total === 1 ? this.i18n.t('movements.offer.one') : this.i18n.t('movements.offer', {count: o.total});
  }

  applyAll(): void {
    this.applying.set(true);
    this.applyError.set(false);
    this.costs.apply(false).subscribe({
      next: done => {
        this.applying.set(false);
        this.offer.set(null);
        this.status.set(done.total === 1 ? this.i18n.t('costs.applied.one') : this.i18n.t('costs.applied', {count: done.total}));
        this.reload();
      },
      error: () => {
        this.applying.set(false);
        this.applyError.set(true);
      }
    });
  }
}
