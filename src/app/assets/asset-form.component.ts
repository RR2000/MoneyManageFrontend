import {afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, input, OnInit,
  output, signal, viewChild} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {IconComponent} from '../ui/icon.component';
import {ASSET_TYPES, AssetDraft, AssetsService, AssetType, DraftErrors, DraftField, emptyDraft, OTHER_KINDS,
  SERVER_ERRORS, validate} from './assets.service';

/** what the form is opened on: a new one of a type, or one that is there (id) */
export interface FormTarget {
  type: AssetType;
  id: number | null;
  draft: AssetDraft;
}

const TYPE_LABELS: Record<AssetType, MessageKey> = {
  realEstate: 'assets.type.realEstate',
  other: 'assets.type.other',
  debt: 'assets.type.debt'
};

const TITLES: Record<AssetType, [MessageKey, MessageKey]> = {
  realEstate: ['assets.form.newRealEstate', 'assets.form.editRealEstate'],
  other: ['assets.form.newOther', 'assets.form.editOther'],
  debt: ['assets.form.newDebt', 'assets.form.editDebt']
};

/** common currencies offered while typing; any ISO code can be written */
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'CAD', 'AUD'];

/**
 * The one form of the assets page: a property, another asset or a debt, new or changed. A new one starts with the
 * choice of the type, which shows the fields of that type; a change keeps its type. Every field has a real label, its
 * error is written under it (and the first wrong field gets the focus), the server's refusals go next to their field
 * or under the form. Escape or "Cancel" closes it.
 */
@Component({
  selector: 'app-asset-form',
  imports: [FormsModule, TPipe, IconComponent],
  template: `
    <form class="form" novalidate (ngSubmit)="save()" (keydown.escape)="cancel()">
      <h2 #title tabindex="-1" [id]="uid + '-title'">{{ titleKey() | t }}</h2>
      @if (isNew()) {
        <fieldset class="full types">
          <legend>{{ 'assets.form.type' | t }}</legend>
          <div class="seg">
            @for (t of types; track t) {
              <label [class.on]="type() === t">
                <input type="radio" name="type" [value]="t" [checked]="type() === t" (change)="setType(t)">
                <span>{{ typeLabel(t) | t }}</span>
              </label>
            }
          </div>
        </fieldset>
      }

      <div class="field full">
        <label [for]="uid + '-name'">{{ 'assets.field.name' | t }}</label>
        <input [id]="uid + '-name'" name="name" [(ngModel)]="draft.name" [maxlength]="200" autocomplete="off"
               [placeholder]="placeholder() | t" [attr.aria-invalid]="!!errors().name" [attr.aria-describedby]="err('name')">
        @if (errors().name; as e) {<p class="ferr" [id]="uid + '-name-err'"><app-icon name="error"/>{{ e | t }}</p>}
      </div>

      @switch (type()) {
        @case ('realEstate') {
          <div class="field full">
            <label [for]="uid + '-address'">{{ 'assets.field.address' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-address'" name="address" [(ngModel)]="draft.address" [maxlength]="300" autocomplete="street-address"
                   [attr.aria-invalid]="!!errors().address" [attr.aria-describedby]="err('address')">
            @if (errors().address; as e) {<p class="ferr" [id]="uid + '-address-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-value'">{{ 'assets.field.estimatedValue' | t }}</label>
            <input [id]="uid + '-value'" name="value" type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="draft.value"
                   [attr.aria-invalid]="!!errors().value" [attr.aria-describedby]="err('value')">
            @if (errors().value; as e) {<p class="ferr" [id]="uid + '-value-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-purchaseDate'">{{ 'assets.field.purchaseDate' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-purchaseDate'" name="purchaseDate" type="date" min="1900-01-01" [(ngModel)]="draft.purchaseDate"
                   [attr.aria-invalid]="!!errors().purchaseDate" [attr.aria-describedby]="hint('purchaseDate')">
            <p class="hint" [id]="uid + '-purchaseDate-hint'">{{ 'assets.hint.purchaseDate' | t }}</p>
            @if (errors().purchaseDate; as e) {<p class="ferr" [id]="uid + '-purchaseDate-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-purchasePrice'">{{ 'assets.field.purchasePrice' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-purchasePrice'" name="purchasePrice" type="number" inputmode="decimal" min="0" step="any"
                   [(ngModel)]="draft.purchasePrice" [attr.aria-invalid]="!!errors().purchasePrice" [attr.aria-describedby]="err('purchasePrice')">
            @if (errors().purchasePrice; as e) {<p class="ferr" [id]="uid + '-purchasePrice-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-monthlyRent'">{{ 'assets.field.monthlyRent' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-monthlyRent'" name="monthlyRent" type="number" inputmode="decimal" min="0" step="any"
                   [(ngModel)]="draft.monthlyRent" [attr.aria-invalid]="!!errors().monthlyRent" [attr.aria-describedby]="err('monthlyRent')">
            @if (errors().monthlyRent; as e) {<p class="ferr" [id]="uid + '-monthlyRent-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-monthlyExpenses'">{{ 'assets.field.monthlyExpenses' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-monthlyExpenses'" name="monthlyExpenses" type="number" inputmode="decimal" min="0" step="any"
                   [(ngModel)]="draft.monthlyExpenses" [attr.aria-invalid]="!!errors().monthlyExpenses" [attr.aria-describedby]="err('monthlyExpenses')">
            @if (errors().monthlyExpenses; as e) {<p class="ferr" [id]="uid + '-monthlyExpenses-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
        }
        @case ('other') {
          <div class="field">
            <label [for]="uid + '-kind'">{{ 'assets.field.kind' | t }}</label>
            <select [id]="uid + '-kind'" name="kind" [(ngModel)]="draft.kind" [attr.aria-invalid]="!!errors().kind"
                    [attr.aria-describedby]="err('kind')">
              @for (k of kinds; track k) {
                <option [value]="k">{{ kindLabel(k) }}</option>
              }
            </select>
            @if (errors().kind; as e) {<p class="ferr" [id]="uid + '-kind-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-value'">{{ 'assets.field.estimatedValue' | t }}</label>
            <input [id]="uid + '-value'" name="value" type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="draft.value"
                   [attr.aria-invalid]="!!errors().value" [attr.aria-describedby]="err('value')">
            @if (errors().value; as e) {<p class="ferr" [id]="uid + '-value-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-valuedOn'">{{ 'assets.field.valuedOn' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-valuedOn'" name="valuedOn" type="date" min="1900-01-01" [max]="today()" [(ngModel)]="draft.valuedOn"
                   [attr.aria-invalid]="!!errors().valuedOn" [attr.aria-describedby]="hint('valuedOn')">
            <p class="hint" [id]="uid + '-valuedOn-hint'">{{ 'assets.hint.valuedOn' | t }}</p>
            @if (errors().valuedOn; as e) {<p class="ferr" [id]="uid + '-valuedOn-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
        }
        @case ('debt') {
          <div class="field">
            <label [for]="uid + '-balance'">{{ 'assets.field.balance' | t }}</label>
            <input [id]="uid + '-balance'" name="balance" type="number" inputmode="decimal" min="0" step="any" [(ngModel)]="draft.balance"
                   [attr.aria-invalid]="!!errors().balance" [attr.aria-describedby]="hint('balance')">
            <p class="hint" [id]="uid + '-balance-hint'">{{ 'assets.hint.balance' | t }}</p>
            @if (errors().balance; as e) {<p class="ferr" [id]="uid + '-balance-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-monthlyPayment'">{{ 'assets.field.monthlyPayment' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-monthlyPayment'" name="monthlyPayment" type="number" inputmode="decimal" min="0" step="any"
                   [(ngModel)]="draft.monthlyPayment" [attr.aria-invalid]="!!errors().monthlyPayment" [attr.aria-describedby]="err('monthlyPayment')">
            @if (errors().monthlyPayment; as e) {<p class="ferr" [id]="uid + '-monthlyPayment-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-annualRate'">{{ 'assets.field.annualRate' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <span class="suffix"><input [id]="uid + '-annualRate'" name="annualRate" type="number" inputmode="decimal" min="0" max="100"
                   step="any" [(ngModel)]="draft.annualRate" [attr.aria-invalid]="!!errors().annualRate"
                   [attr.aria-describedby]="err('annualRate')"><span aria-hidden="true">%</span></span>
            @if (errors().annualRate; as e) {<p class="ferr" [id]="uid + '-annualRate-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <div class="field">
            <label [for]="uid + '-endDate'">{{ 'assets.field.endDate' | t }} <span class="opt">{{ 'assets.optional' | t }}</span></label>
            <input [id]="uid + '-endDate'" name="endDate" type="date" min="1900-01-01" [(ngModel)]="draft.endDate"
                   [attr.aria-invalid]="!!errors().endDate" [attr.aria-describedby]="hint('endDate')">
            <p class="hint" [id]="uid + '-endDate-hint'">{{ 'assets.hint.endDate' | t }}</p>
            @if (errors().endDate; as e) {<p class="ferr" [id]="uid + '-endDate-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
        }
      }

      <div class="field">
        <label [for]="uid + '-currency'">{{ 'assets.field.currency' | t }}</label>
        <input [id]="uid + '-currency'" name="currency" [(ngModel)]="draft.currency" maxlength="3" autocomplete="off"
               autocapitalize="characters" spellcheck="false" [attr.list]="uid + '-currencies'" class="short"
               [attr.aria-invalid]="!!errors().currency" [attr.aria-describedby]="hint('currency')">
        <datalist [id]="uid + '-currencies'">
          @for (c of currencies; track c) {
            <option [value]="c"></option>
          }
        </datalist>
        <p class="hint" [id]="uid + '-currency-hint'">{{ 'assets.hint.currency' | t }}</p>
        @if (errors().currency; as e) {<p class="ferr" [id]="uid + '-currency-err'"><app-icon name="error"/>{{ e | t }}</p>}
      </div>

      @if (serverError()) {
        <p class="full alert" role="alert"><app-icon name="error"/><span>{{ serverError() }}</span></p>
      }
      <div class="full buttons">
        <button type="submit" class="btn primary" [disabled]="busy()">{{ (busy() ? 'common.wait' : 'common.save') | t }}</button>
        <button type="button" class="btn" (click)="cancel()" [disabled]="busy()">{{ 'common.cancel' | t }}</button>
      </div>
    </form>`,
  styles: [`
    :host { display: block; min-width: 0; }
    .form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
    .full { grid-column: 1 / -1; }
    h2 { grid-column: 1 / -1; margin: 0; font-size: 1.05rem; font-weight: 700; }
    h2:focus { outline: none; }
    h2:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    legend, label { font-size: .84rem; font-weight: 600; color: var(--fg); padding: 0; margin-bottom: 4px; }
    .seg { display: flex; flex-wrap: wrap; gap: 4px; background: var(--surface-2); padding: 4px; border-radius: 10px; }
    .seg label { position: relative; display: inline-flex; align-items: center; min-height: 40px; padding: 6px 14px;
      border-radius: 8px; color: var(--muted); cursor: pointer; margin: 0; font-size: .9rem; }
    .seg input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
    .seg label.on { background: var(--surface); color: var(--fg); font-weight: 700; box-shadow: 0 1px 2px rgba(0, 0, 0, .18); }
    .seg label:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 1px; }
    .field { display: grid; gap: 4px; align-content: start; min-width: 0; }
    .field input, .field select { width: 100%; min-width: 0; min-height: 44px; padding: 8px 10px; font-size: 1rem;
      border-radius: 8px; }
    .field input.short { max-width: 9rem; text-transform: uppercase; }
    .field input[aria-invalid="true"], .field select[aria-invalid="true"] { border-color: var(--bad); border-width: 2px; }
    .suffix { display: flex; align-items: center; gap: 6px; }
    .opt { font-weight: 400; color: var(--muted); }
    .hint { margin: 0; font-size: .78rem; color: var(--muted); }
    .ferr { display: flex; gap: 5px; align-items: flex-start; margin: 0; font-size: .82rem; color: var(--bad);
      font-weight: 600; --icon-size: 15px; }
    .ferr app-icon { margin-top: 1px; }
    .alert { display: flex; gap: 6px; align-items: flex-start; margin: 0; color: var(--bad); font-weight: 600; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    @media (max-width: 599px) {
      .form { grid-template-columns: minmax(0, 1fr); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetFormComponent implements OnInit {
  readonly target = input.required<FormTarget>();
  readonly today = input.required<string>();
  /** saved: the page reads everything again; the type is said in the confirmation */
  readonly saved = output<AssetType>();
  readonly cancelled = output<void>();

  private readonly i18n = inject(I18nService);
  private readonly service = inject(AssetsService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  readonly uid = 'af-' + Math.random().toString(36).slice(2, 8);
  readonly types = ASSET_TYPES;
  readonly kinds = OTHER_KINDS;
  readonly currencies = CURRENCIES;

  readonly type = signal<AssetType>('realEstate');
  readonly errors = signal<DraftErrors>({});
  readonly serverError = signal('');
  readonly busy = signal(false);
  draft: AssetDraft = emptyDraft();

  readonly isNew = computed(() => this.target().id === null);
  readonly titleKey = computed(() => TITLES[this.type()][this.isNew() ? 0 : 1]);
  readonly placeholder = computed<MessageKey>(() => this.type() === 'realEstate' ? 'assets.placeholder.realEstate'
    : this.type() === 'other' ? 'assets.placeholder.other' : 'assets.placeholder.debt');

  constructor() {
    // the form opens with the focus on its title, so a screen reader says what it is
    afterNextRender(() => {
      this.title()?.nativeElement.focus();
      this.host.nativeElement.scrollIntoView?.({block: 'start', behavior: 'smooth'});
    });
  }

  ngOnInit(): void {
    const target = this.target();
    this.type.set(target.type);
    this.draft = {...target.draft};
  }

  typeLabel(t: AssetType): MessageKey {
    return TYPE_LABELS[t];
  }

  kindLabel(k: string): string {
    return this.i18n.t(('assets.kind.' + k) as MessageKey);
  }

  setType(t: AssetType): void {
    this.type.set(t);
    this.errors.set({});
    this.serverError.set('');
  }

  /** the error under a field, for aria-describedby */
  err(field: DraftField): string | null {
    return this.errors()[field] ? `${this.uid}-${field}-err` : null;
  }

  /** the hint under a field and its error */
  hint(field: DraftField): string {
    return `${this.uid}-${field}-hint` + (this.errors()[field] ? ` ${this.uid}-${field}-err` : '');
  }

  cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }

  save(): void {
    const errors = validate(this.type(), this.draft, this.today());
    this.errors.set(errors);
    this.serverError.set('');
    if (Object.keys(errors).length) {
      this.focusFirstError();
      return;
    }
    const type = this.type();
    this.busy.set(true);
    this.service.save(type, this.target().id, this.draft).subscribe({
      next: () => {
        this.busy.set(false);
        this.saved.emit(type);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const known = err.status === 400 ? SERVER_ERRORS[err.error?.message as string] : undefined;
        if (known?.field) {
          this.errors.set({[known.field]: known.key});
          this.focusFirstError();
        } else if (known) {
          this.serverError.set(this.i18n.t(known.key));
        } else {
          this.serverError.set(err.status === 0 ? this.i18n.t('common.unreachable')
            : err.status === 404 ? this.i18n.t('assets.error.gone') : this.i18n.t('common.failed'));
        }
      }
    });
  }

  private focusFirstError(): void {
    afterNextRender(() => {
      const first = this.host.nativeElement.querySelector('[aria-invalid="true"]') as HTMLElement | null;
      first?.focus();
    }, {injector: this.injector});
  }
}
