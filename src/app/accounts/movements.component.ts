import {Component, computed, effect, inject, input, OnDestroy, signal, untracked} from '@angular/core';
import {Subscription} from 'rxjs';
import {AccountsService, Movement, MovementKind} from './accounts.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {AmountComponent} from '../ui/amount.component';
import {IconComponent} from '../ui/icon.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {SourceTagComponent} from '../ui/source-tag.component';

export const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;

const KINDS: { kind: MovementKind; label: MessageKey }[] = [
  {kind: 'ALL', label: 'movements.all'},
  {kind: 'IN', label: 'movements.in'},
  {kind: 'OUT', label: 'movements.out'}
];

/**
 * The movements of an account as a list by day, newest first (on a phone too: never a table with a column per
 * account): search by words or amount, money in or out, where each row comes from, and "Load 50 more".
 */
@Component({
  selector: 'app-movements',
  imports: [TPipe, AmountComponent, IconComponent, LoadStateComponent, SourceTagComponent],
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
    </div>
    @if (state() === 'ready') {
      <ul class="rows" [attr.aria-busy]="loadingMore()">
        @for (day of days(); track day.key) {
          <li class="day" role="presentation">{{ day.label }}</li>
          @for (m of day.items; track m.id) {
            <li class="row">
              <span class="d">{{ m.description }}</span>
              <app-amount class="amt" [value]="m.amount" [currency]="m.currency || currency()" [signed]="true"/>
              <span class="m"><app-source-tag [source]="m.source"/></span>
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
      <app-load-state [state]="state()" [emptyText]="(query() || kind() !== 'ALL' ? 'movements.noMatch' : 'movements.none') | t"
                      (retry)="reload()"/>
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
    .rows { list-style: none; margin: 0; padding: 0; }
    .day { font-size: .76rem; font-weight: 700; color: var(--muted); padding: 14px 0 4px; letter-spacing: .04em;
      text-transform: uppercase; border-bottom: 1px solid var(--line); }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 12px; padding: 9px 0;
      border-bottom: 1px solid var(--line); align-items: center; }
    .d { font-weight: 500; overflow-wrap: anywhere; }
    .amt { font-weight: 600; text-align: right; grid-row: 1 / span 2; grid-column: 2; }
    .m { grid-column: 1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .more { justify-self: center; }
  `]
})
export class MovementsComponent implements OnDestroy {
  /** id of the account (its page) */
  readonly accountId = input.required<string>();
  readonly currency = input('EUR');
  readonly pageSize = PAGE_SIZE;
  readonly kinds = KINDS;

  private service = inject(AccountsService);
  private i18n = inject(I18nService);

  readonly query = signal('');
  readonly kind = signal<MovementKind>('ALL');
  readonly items = signal<Movement[]>([]);
  readonly hasMore = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly loadingMore = signal(false);
  readonly moreError = signal(false);
  private timer?: ReturnType<typeof setTimeout>;
  private call?: Subscription;

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
      untracked(() => this.reload());
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

  reload(): void {
    this.call?.unsubscribe();
    this.state.set('loading');
    this.moreError.set(false);
    this.call = this.service.movements(this.accountId(), {q: this.query().trim(), kind: this.kind(), offset: 0, limit: PAGE_SIZE})
      .subscribe({
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
    this.call = this.service.movements(this.accountId(),
      {q: this.query().trim(), kind: this.kind(), offset: this.items().length, limit: PAGE_SIZE}).subscribe({
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
}
