import {afterNextRender, Component, computed, ElementRef, inject, Injector, OnDestroy, OnInit, signal} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {IconComponent} from '../ui/icon.component';
import {AssetFormComponent, FormTarget} from './asset-form.component';
import {AssetsAnswer, AssetsService, AssetsTotal, AssetType, Debt, draftOf, emptyDraft, OtherAsset, payoffText,
  RealEstate} from './assets.service';

/** a box of the summary: label, amount with its sign written, a note */
interface Tile {
  label: string;
  value: string;
  sign: 1 | -1 | 0;
  note: string;
}

const SAVED: Record<AssetType, MessageKey> = {
  realEstate: 'assets.saved.realEstate',
  other: 'assets.saved.other',
  debt: 'assets.saved.debt'
};

/**
 * /assets: what the user owns besides accounts and investments, and what they owe. Totals of real estate, other
 * assets, debts and the net in euro (other currencies written apart, never added), the three lists (never a wide
 * table) and one form to add or change any of them; deleting asks first.
 */
@Component({
  selector: 'app-assets-page',
  imports: [NgTemplateOutlet, RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, IconComponent, AssetFormComponent],
  templateUrl: './assets-page.component.html',
  styleUrl: './assets-page.component.css'
})
export class AssetsPageComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly service = inject(AssetsService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  readonly data = signal<AssetsAnswer | null>(null);
  readonly state = signal<LoadState>('loading');
  /** the form, open on a new one or on one that is there */
  readonly form = signal<FormTarget | null>(null);
  /** the row asking "delete?" (type:id), and the one being deleted */
  readonly confirming = signal<string | null>(null);
  readonly deleting = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly status = signal('');
  private call?: Subscription;
  /** where the focus goes back when the form closes */
  private opener: HTMLElement | null = null;

  readonly today = computed(() => this.data()?.today ?? isoToday());
  readonly euro = computed<AssetsTotal | null>(() => this.data()?.totals.find(t => t.currency === 'EUR') ?? null);
  readonly others = computed(() => this.data()?.totals.filter(t => t.currency !== 'EUR') ?? []);
  readonly nothing = computed(() => {
    const d = this.data();
    return !!d && d.realEstates.length + d.otherAssets.length + d.debts.length === 0;
  });

  readonly tiles = computed<Tile[]>(() => {
    const t = this.euro();
    const d = this.data();
    if (!t || !d) {
      return [];
    }
    const m = (v: number) => this.i18n.money(v, t.currency, 0);
    const s = (v: number) => this.i18n.signedMoney(v, t.currency, 0);
    const sign = (v: number): 1 | -1 | 0 => v > 0 ? 1 : v < 0 ? -1 : 0;
    const count = (n: number, one: MessageKey, many: MessageKey) => n === 1 ? this.i18n.t(one) : this.i18n.t(many, {count: n});
    return [
      {label: this.i18n.t('assets.realEstate'), value: m(t.realEstate), sign: 0,
        note: count(d.realEstates.length, 'home.properties.one', 'home.properties')},
      {label: this.i18n.t('assets.other'), value: m(t.otherAssets), sign: 0,
        note: count(d.otherAssets.length, 'assets.count.other.one', 'assets.count.other')},
      {label: this.i18n.t('assets.debts'), value: s(t.debts), sign: sign(t.debts),
        note: count(d.debts.length, 'assets.count.debt.one', 'assets.count.debt')},
      {label: this.i18n.t('assets.net'), value: s(t.net), sign: sign(t.net), note: this.i18n.t('assets.net.note')}
    ];
  });

  /** "In USD, kept apart: other assets $1,000, debts −$200, net +$800" */
  otherCurrencyText(t: AssetsTotal): string {
    const parts: string[] = [];
    if (t.realEstate) {
      parts.push(this.i18n.t('assets.part.realEstate', {amount: this.i18n.money(t.realEstate, t.currency, 0)}));
    }
    if (t.otherAssets) {
      parts.push(this.i18n.t('assets.part.other', {amount: this.i18n.money(t.otherAssets, t.currency, 0)}));
    }
    if (t.debts) {
      parts.push(this.i18n.t('assets.part.debts', {amount: this.i18n.signedMoney(t.debts, t.currency, 0)}));
    }
    parts.push(this.i18n.t('assets.part.net', {amount: this.i18n.signedMoney(t.net, t.currency, 0)}));
    return this.i18n.t('assets.otherCurrency', {currency: t.currency, parts: parts.join(', ')});
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.call?.unsubscribe();
  }

  /** `quiet`: after a change, the page stays on screen while it reads again */
  load(quiet = false): void {
    if (!quiet || !this.data()) {
      this.state.set('loading');
    }
    this.call?.unsubscribe();
    this.call = this.service.summary().subscribe({
      next: data => {
        this.data.set(data);
        this.state.set('ready');
      },
      error: () => {
        if (!this.data()) {
          this.state.set('error');
        }
      }
    });
  }

  add(type: AssetType, event?: Event): void {
    this.opener = (event?.currentTarget as HTMLElement | null) ?? null;
    this.status.set('');
    this.confirming.set(null);
    this.form.set({type, id: null, draft: emptyDraft()});
  }

  edit(type: AssetType, item: RealEstate | OtherAsset | Debt, event: Event): void {
    this.opener = event.currentTarget as HTMLElement;
    this.status.set('');
    this.confirming.set(null);
    this.form.set({type, id: item.id, draft: draftOf(type, item)});
  }

  closeForm(): void {
    this.form.set(null);
    const opener = this.opener;
    afterNextRender(() => opener?.isConnected && opener.focus(), {injector: this.injector});
  }

  saved(type: AssetType): void {
    this.form.set(null);
    this.status.set(this.i18n.t(SAVED[type]));
    this.load(true);
    afterNextRender(() => (this.host.nativeElement.querySelector('.add-main') as HTMLElement | null)?.focus(),
      {injector: this.injector});
  }

  key(type: AssetType, id: number): string {
    return `${type}:${id}`;
  }

  askDelete(type: AssetType, id: number): void {
    this.deleteError.set(null);
    this.confirming.set(this.key(type, id));
    afterNextRender(() => (this.host.nativeElement.querySelector('.confirm .no') as HTMLElement | null)?.focus(),
      {injector: this.injector});
  }

  cancelDelete(type: AssetType, id: number): void {
    this.confirming.set(null);
    this.deleteError.set(null);
    afterNextRender(() => (this.host.nativeElement.querySelector(`[data-del="${this.key(type, id)}"]`) as HTMLElement | null)
      ?.focus(), {injector: this.injector});
  }

  remove(type: AssetType, item: RealEstate | OtherAsset | Debt): void {
    const key = this.key(type, item.id);
    this.deleting.set(key);
    this.deleteError.set(null);
    this.service.remove(type, item.id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.confirming.set(null);
        if (this.form()?.id === item.id && this.form()?.type === type) {
          this.form.set(null);
        }
        this.status.set(this.i18n.t('assets.deleted', {name: item.name}));
        this.load(true);
      },
      error: err => {
        this.deleting.set(null);
        // already gone (deleted elsewhere): read the page again
        if (err?.status === 404) {
          this.confirming.set(null);
          this.load(true);
          return;
        }
        this.deleteError.set(err?.status === 0 ? this.i18n.t('common.unreachable') : this.i18n.t('common.failed'));
      }
    });
  }

  money(value: number | null, currency: string | null): string {
    return value === null ? '–' : this.i18n.money(value, currency || 'EUR', Math.abs(value) >= 1000 ? 0 : 2);
  }

  isEuro(currency: string | null): boolean {
    return !currency || currency.toUpperCase() === 'EUR';
  }

  kindLabel(kind: string): string {
    return this.i18n.t(('assets.kind.' + kind) as MessageKey);
  }

  /** a property bought after today is listed, not yet counted */
  notYet(r: RealEstate): boolean {
    return !!r.purchaseDate && r.purchaseDate > this.today();
  }

  payoff(d: Debt): { text: string; warn: boolean } {
    return payoffText(this.i18n, d.payoff);
  }

  /** "Via ..., bought on 15 Jun 2019" */
  reMeta(r: RealEstate): string {
    return join([r.address, r.purchaseDate ? this.i18n.t('assets.boughtOn', {date: this.i18n.date(r.purchaseDate)}) : '']);
  }

  /** "Car or motorbike · estimate of 1 Aug 2026" */
  otherMeta(o: OtherAsset): string {
    return join([this.kindLabel(o.kind), o.valuedOn ? this.i18n.t('assets.valuedOn', {date: this.i18n.date(o.valuedOn)})
      : this.i18n.t('assets.valuedOn.none')]);
  }

  /** "payment €280.00 a month · rate 5.9% a year" */
  debtMeta(d: Debt): string {
    return join([
      d.monthlyPayment === null ? '' : this.i18n.t('assets.payment', {amount: this.money(d.monthlyPayment, d.currency)}),
      d.annualRate === null ? '' : this.i18n.t('assets.rate', {rate: this.i18n.number(d.annualRate, 0, 3)})
    ]);
  }
}

function join(parts: (string | null)[]): string {
  return parts.filter(p => !!p).join(' · ');
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
