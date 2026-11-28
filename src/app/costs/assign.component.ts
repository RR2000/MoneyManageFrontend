import {afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, Injector, input, OnInit,
  output, signal, viewChild} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {switchMap, of} from 'rxjs';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {IconComponent} from '../ui/icon.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {Assigned, Category, checkName, checkPattern, CostsService, Direction, SERVER_ERRORS,
  suggestPattern} from './costs.service';

/** the movement whose category is chosen */
export interface AssignTarget {
  id: number;
  description: string;
  amount: number;
  categoryId: number | null;
}

const NEW = 'new';

/**
 * The category of one movement, chosen by hand, in the row of the movement: a category of the list or a new one, and
 * optionally a rule for the movements like this one (its text starts from the description, money out or in from the
 * sign). Real labels, errors next to their field, Escape or "Cancel" closes it.
 */
@Component({
  selector: 'app-assign',
  imports: [FormsModule, TPipe, IconComponent, LoadStateComponent],
  template: `
    @if (state() !== 'ready') {
      <app-load-state [state]="state()" (retry)="load()"/>
    } @else {
      <form class="assign" novalidate (ngSubmit)="save()" (keydown.escape)="cancel()">
        <p #title class="title" tabindex="-1">{{ 'costs.assign.title' | t }}</p>
        <div class="field">
          <label [for]="uid + '-cat'">{{ 'costs.field.category' | t }}</label>
          <select [id]="uid + '-cat'" name="category" [(ngModel)]="choice" (ngModelChange)="errors.set({})"
                  [attr.aria-invalid]="!!errors().category" [attr.aria-describedby]="errors().category ? uid + '-cat-err' : null">
            <option value="">{{ 'costs.assign.none' | t }}</option>
            @for (c of categories(); track c.id) {
              <option [value]="'' + c.id">{{ c.name }}{{ c.fixed ? ' · ' + ('costs.fixed.short' | t) : '' }}</option>
            }
            <option [value]="newValue">{{ 'costs.assign.new' | t }}</option>
          </select>
          @if (errors().category; as e) {<p class="ferr" [id]="uid + '-cat-err'"><app-icon name="error"/>{{ e | t }}</p>}
        </div>
        @if (choice === newValue) {
          <div class="field">
            <label [for]="uid + '-name'">{{ 'costs.field.newName' | t }}</label>
            <input [id]="uid + '-name'" name="name" [(ngModel)]="newName" maxlength="60" autocomplete="off"
                   [placeholder]="'costs.placeholder.category' | t"
                   [attr.aria-invalid]="!!errors().name" [attr.aria-describedby]="errors().name ? uid + '-name-err' : null">
            @if (errors().name; as e) {<p class="ferr" [id]="uid + '-name-err'"><app-icon name="error"/>{{ e | t }}</p>}
          </div>
          <label class="check"><input type="checkbox" name="fixed" [(ngModel)]="newFixed">
            <span>{{ 'costs.field.fixed' | t }}</span></label>
        }
        @if (choice !== '') {
          <label class="check"><input type="checkbox" name="withRule" [(ngModel)]="withRule">
            <span>{{ 'costs.assign.withRule' | t }}</span></label>
          @if (withRule) {
            <div class="rule">
              <div class="field">
                <label [for]="uid + '-pattern'">{{ 'costs.field.pattern' | t }}</label>
                <input [id]="uid + '-pattern'" name="pattern" [(ngModel)]="pattern" maxlength="100" autocomplete="off"
                       spellcheck="false" [attr.aria-invalid]="!!errors().pattern"
                       [attr.aria-describedby]="uid + '-pattern-hint' + (errors().pattern ? ' ' + uid + '-pattern-err' : '')">
                <p class="hint" [id]="uid + '-pattern-hint'">{{ 'costs.hint.pattern' | t }}</p>
                @if (errors().pattern; as e) {<p class="ferr" [id]="uid + '-pattern-err'"><app-icon name="error"/>{{ e | t }}</p>}
              </div>
              <div class="field">
                <label [for]="uid + '-dir'">{{ 'costs.field.direction' | t }}</label>
                <select [id]="uid + '-dir'" name="direction" [(ngModel)]="direction">
                  <option value="OUT">{{ 'costs.direction.OUT' | t }}</option>
                  <option value="IN">{{ 'costs.direction.IN' | t }}</option>
                  <option value="">{{ 'costs.direction.any' | t }}</option>
                </select>
              </div>
              <label class="check"><input type="checkbox" name="onlyHere" [(ngModel)]="onlyHere">
                <span>{{ 'costs.assign.onlyHere' | t }}</span></label>
            </div>
          }
        }
        @if (serverError()) {
          <p class="alert" role="alert"><app-icon name="error"/><span>{{ serverError() }}</span></p>
        }
        <div class="buttons">
          <button type="submit" class="btn primary" [disabled]="busy()">{{ (busy() ? 'common.wait' : 'common.save') | t }}</button>
          <button type="button" class="btn" (click)="cancel()" [disabled]="busy()">{{ 'common.cancel' | t }}</button>
        </div>
      </form>
    }`,
  styles: [`
    :host { display: block; min-width: 0; grid-column: 1 / -1; margin-top: 6px; padding: 12px; border-radius: 10px;
      background: var(--surface-2); border: 1px solid var(--accent); }
    .assign { display: grid; gap: 12px; }
    .title { margin: 0; font-weight: 700; }
    .title:focus { outline: none; }
    .title:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    .field { display: grid; gap: 4px; min-width: 0; }
    label { font-size: .84rem; font-weight: 600; }
    .field input, .field select { width: 100%; min-width: 0; min-height: 44px; padding: 8px 10px; font-size: 1rem;
      border-radius: 8px; }
    .field input[aria-invalid="true"], .field select[aria-invalid="true"] { border-color: var(--bad); border-width: 2px; }
    .check { display: flex; gap: 8px; align-items: center; min-height: 40px; font-weight: 500; font-size: .92rem; }
    .check input { width: 20px; height: 20px; margin: 0; flex: none; accent-color: var(--accent); }
    .rule { display: grid; gap: 12px; padding-left: 12px; border-left: 3px solid var(--line-strong); }
    .hint { margin: 0; font-size: .78rem; color: var(--muted); }
    .ferr { display: flex; gap: 5px; align-items: flex-start; margin: 0; font-size: .82rem; color: var(--bad);
      font-weight: 600; --icon-size: 15px; }
    .alert { display: flex; gap: 6px; align-items: flex-start; margin: 0; color: var(--bad); font-weight: 600; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignComponent implements OnInit {
  readonly target = input.required<AssignTarget>();
  readonly saved = output<Assigned>();
  readonly cancelled = output<void>();

  private readonly service = inject(CostsService);
  private readonly i18n = inject(I18nService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  readonly uid = 'as-' + Math.random().toString(36).slice(2, 8);
  readonly newValue = NEW;
  readonly state = signal<LoadState>('loading');
  readonly categories = signal<Category[]>([]);
  readonly errors = signal<Partial<Record<'category' | 'name' | 'pattern', MessageKey>>>({});
  readonly serverError = signal('');
  readonly busy = signal(false);

  choice = '';
  newName = '';
  newFixed = false;
  withRule = false;
  pattern = '';
  direction: Direction | '' = 'OUT';
  onlyHere = false;

  ngOnInit(): void {
    const t = this.target();
    this.choice = t.categoryId === null ? '' : '' + t.categoryId;
    this.pattern = suggestPattern(t.description);
    this.direction = t.amount < 0 ? 'OUT' : t.amount > 0 ? 'IN' : '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.service.overview().subscribe({
      next: overview => {
        this.categories.set(overview.categories);
        if (!overview.categories.length) {
          this.choice = NEW;
        }
        this.state.set('ready');
        afterNextRender(() => {
          this.title()?.nativeElement.focus();
          this.host.nativeElement.scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
        }, {injector: this.injector});
      },
      error: () => this.state.set('error')
    });
  }

  cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }

  save(): void {
    const errors: Partial<Record<'category' | 'name' | 'pattern', MessageKey>> = {};
    if (this.choice === NEW) {
      const e = checkName(this.newName);
      if (e) {
        errors.name = e;
      } else if (this.categories().some(c => c.name.toLowerCase() === this.newName.trim().replace(/\s+/g, ' ').toLowerCase())) {
        errors.name = 'costs.error.nameTaken';
      }
    }
    const withRule = this.choice !== '' && this.withRule;
    if (withRule) {
      const e = checkPattern(this.pattern);
      if (e) {
        errors.pattern = e;
      }
    }
    this.errors.set(errors);
    this.serverError.set('');
    if (Object.keys(errors).length) {
      this.focusFirstError();
      return;
    }
    this.busy.set(true);
    const rule = withRule ? {pattern: this.pattern.trim(), direction: this.direction || null, onlyThisAccount: this.onlyHere}
      : null;
    const category$ = this.choice === NEW ? this.service.createCategory(this.newName.trim(), this.newFixed)
      : of(this.choice === '' ? null : {id: Number(this.choice)});
    category$.pipe(switchMap(category => {
      if (category && this.choice === NEW) {
        // the new category is there now: a second try only assigns
        this.categories.update(list => [...list, category as Category]);
        this.choice = '' + category.id;
      }
      return this.service.assign(this.target().id, category ? category.id : null, rule);
    })).subscribe({
      next: assigned => {
        this.busy.set(false);
        this.saved.emit(assigned);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const known = err.status === 400 ? SERVER_ERRORS[err.error?.message as string] : undefined;
        if (known?.field === 'name' || known?.field === 'pattern' || known?.field === 'category') {
          this.errors.set({[known.field]: known.key});
          this.focusFirstError();
        } else if (known) {
          this.serverError.set(this.i18n.t(known.key));
        } else {
          this.serverError.set(err.status === 0 ? this.i18n.t('common.unreachable') : this.i18n.t('common.failed'));
        }
      }
    });
  }

  private focusFirstError(): void {
    afterNextRender(() => {
      (this.host.nativeElement.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus();
    }, {injector: this.injector});
  }
}
