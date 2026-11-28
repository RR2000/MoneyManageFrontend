import {afterNextRender, Component, computed, ElementRef, inject, Injector, OnInit, signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';
import {AccountsService, MoneyAccount} from '../accounts/accounts.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {IconComponent} from '../ui/icon.component';
import {Applied, CategoriesOverview, Category, checkName, checkPattern, CostsService, Direction, Rule,
  SERVER_ERRORS} from './costs.service';

type Field = 'name' | 'pattern' | 'category' | 'account';

interface CategoryDraft {
  id: number | null;
  name: string;
  fixed: boolean;
}

interface RuleDraft {
  id: number | null;
  categoryId: string;
  pattern: string;
  direction: Direction | '';
  accountId: string;
}

/**
 * /costs/rules: the categories (fixed or not) and the rules that give them, each with its form in the page (real labels,
 * errors next to the field) and delete with a question in the row; "apply to all" with a preview of how many movements
 * change before anything changes.
 */
@Component({
  selector: 'app-rules-page',
  imports: [FormsModule, RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, IconComponent],
  templateUrl: './rules-page.component.html',
  styleUrl: './rules-page.component.css'
})
export class RulesPageComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private service = inject(CostsService);
  private accountsService = inject(AccountsService);
  private host = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);

  readonly state = signal<LoadState>('loading');
  readonly data = signal<CategoriesOverview | null>(null);
  readonly accounts = signal<MoneyAccount[]>([]);
  readonly status = signal('');

  readonly categoryForm = signal<CategoryDraft | null>(null);
  readonly ruleForm = signal<RuleDraft | null>(null);
  readonly errors = signal<Partial<Record<Field, MessageKey>>>({});
  readonly formError = signal('');
  readonly busy = signal(false);

  /** 'c12' or 'r7': the row asking "delete?" */
  readonly confirming = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal(false);

  readonly preview = signal<Applied | null>(null);
  readonly previewState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly applying = signal(false);
  readonly applyError = signal(false);

  readonly categories = computed(() => this.data()?.categories ?? []);
  readonly rules = computed(() => this.data()?.rules ?? []);
  private readonly names = computed(() => new Map(this.categories().map(c => [c.id, c.name])));

  // the forms bind to plain objects (ngModel); the signals above say which form is open
  category: CategoryDraft = {id: null, name: '', fixed: true};
  rule: RuleDraft = {id: null, categoryId: '', pattern: '', direction: 'OUT', accountId: ''};

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    forkJoin({overview: this.service.overview(), accounts: this.accountsService.list()}).subscribe({
      next: ({overview, accounts}) => {
        this.data.set(overview);
        this.accounts.set(accounts);
        this.state.set('ready');
      },
      error: () => this.state.set('error')
    });
  }

  /** after a change: the lists again, the page stays on screen */
  private refresh(): void {
    this.service.overview().subscribe({
      next: overview => this.data.set(overview),
      error: () => this.state.set('error')
    });
  }

  categoryName(id: number): string {
    return this.names().get(id) ?? '';
  }

  /** "Money out · only Conto corrente" */
  ruleMeta(r: Rule): string {
    const parts = [this.i18n.t(r.direction ? (`costs.direction.${r.direction}` as MessageKey) : 'costs.direction.any')];
    if (r.account) {
      parts.push(this.i18n.t('costs.rule.onlyAccount', {account: r.account}));
    }
    return parts.join(' · ');
  }

  categoryMeta(c: Category): string {
    const movements = c.movements === 1 ? this.i18n.t('costs.count.movement.one')
      : this.i18n.t('costs.count.movement', {count: c.movements});
    const rules = c.rules === 1 ? this.i18n.t('costs.count.rule.one') : this.i18n.t('costs.count.rule', {count: c.rules});
    return movements + ' · ' + rules;
  }

  // ---- forms

  newCategory(): void {
    this.closeForms();
    this.category = {id: null, name: '', fixed: true};
    this.categoryForm.set(this.category);
    this.focusForm('#cat-name');
  }

  editCategory(c: Category): void {
    this.closeForms();
    this.category = {id: c.id, name: c.name, fixed: c.fixed};
    this.categoryForm.set(this.category);
    this.focusForm('#cat-name');
  }

  newRule(categoryId?: number): void {
    this.closeForms();
    const first = categoryId ?? this.categories()[0]?.id;
    this.rule = {id: null, categoryId: first === undefined ? '' : '' + first, pattern: '', direction: 'OUT', accountId: ''};
    this.ruleForm.set(this.rule);
    this.focusForm('#rule-pattern');
  }

  editRule(r: Rule): void {
    this.closeForms();
    this.rule = {id: r.id, categoryId: '' + r.categoryId, pattern: r.pattern, direction: r.direction ?? '',
      accountId: r.accountId ?? ''};
    this.ruleForm.set(this.rule);
    this.focusForm('#rule-pattern');
  }

  closeForms(): void {
    if (this.busy()) {
      return;
    }
    this.categoryForm.set(null);
    this.ruleForm.set(null);
    this.errors.set({});
    this.formError.set('');
    this.confirming.set(null);
  }

  saveCategory(): void {
    const draft = this.category;
    const e = checkName(draft.name);
    const taken = !e && this.categories().some(c => c.id !== draft.id
      && c.name.toLowerCase() === draft.name.trim().replace(/\s+/g, ' ').toLowerCase());
    this.errors.set(e ? {name: e} : taken ? {name: 'costs.error.nameTaken'} : {});
    this.formError.set('');
    if (e || taken) {
      this.focusError();
      return;
    }
    this.busy.set(true);
    const call = draft.id === null ? this.service.createCategory(draft.name.trim(), draft.fixed)
      : this.service.updateCategory(draft.id, draft.name.trim(), draft.fixed);
    call.subscribe({
      next: saved => {
        this.busy.set(false);
        this.categoryForm.set(null);
        this.status.set(this.i18n.t(draft.id === null ? 'costs.saved.newCategory' : 'costs.saved.category', {name: saved.name}));
        this.preview.set(null);
        this.refresh();
      },
      error: (err: HttpErrorResponse) => this.failed(err)
    });
  }

  saveRule(): void {
    const draft = this.rule;
    const errors: Partial<Record<Field, MessageKey>> = {};
    if (!draft.categoryId) {
      errors.category = 'costs.error.category';
    }
    const e = checkPattern(draft.pattern);
    if (e) {
      errors.pattern = e;
    }
    this.errors.set(errors);
    this.formError.set('');
    if (Object.keys(errors).length) {
      this.focusError();
      return;
    }
    this.busy.set(true);
    this.service.saveRule(draft.id, {categoryId: Number(draft.categoryId), pattern: draft.pattern.trim(),
      direction: draft.direction || null, accountId: draft.accountId || null}).subscribe({
      next: saved => {
        this.busy.set(false);
        this.ruleForm.set(null);
        this.status.set(this.i18n.t('costs.saved.rule', {rule: saved.pattern, name: this.categoryName(saved.categoryId)}));
        this.preview.set(null);
        this.refresh();
      },
      error: (err: HttpErrorResponse) => this.failed(err)
    });
  }

  private failed(err: HttpErrorResponse): void {
    this.busy.set(false);
    const known = err.status === 400 ? SERVER_ERRORS[err.error?.message as string] : undefined;
    if (known?.field) {
      this.errors.set({[known.field]: known.key});
      this.focusError();
    } else if (known) {
      this.formError.set(this.i18n.t(known.key));
    } else {
      this.formError.set(err.status === 0 ? this.i18n.t('common.unreachable')
        : err.status === 404 ? this.i18n.t('costs.error.gone') : this.i18n.t('common.failed'));
    }
  }

  private focusForm(selector: string): void {
    afterNextRender(() => {
      const field = this.host.nativeElement.querySelector(selector) as HTMLElement | null;
      field?.focus();
      field?.closest('form')?.scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
    }, {injector: this.injector});
  }

  private focusError(): void {
    afterNextRender(() => {
      (this.host.nativeElement.querySelector('form [aria-invalid="true"]') as HTMLElement | null)?.focus();
    }, {injector: this.injector});
  }

  // ---- delete, with a question in the row

  askDelete(key: string): void {
    this.closeForms();
    this.confirming.set(key);
    this.deleteError.set(false);
  }

  cancelDelete(): void {
    this.confirming.set(null);
  }

  deleteCategory(c: Category): void {
    this.deleting.set(true);
    this.deleteError.set(false);
    this.service.deleteCategory(c.id).subscribe({
      next: () => this.deleted(this.i18n.t('costs.deleted.category', {name: c.name})),
      error: () => this.deleteFailed()
    });
  }

  deleteRule(r: Rule): void {
    this.deleting.set(true);
    this.deleteError.set(false);
    this.service.deleteRule(r.id).subscribe({
      next: () => this.deleted(this.i18n.t('costs.deleted.rule', {rule: r.pattern})),
      error: () => this.deleteFailed()
    });
  }

  private deleted(text: string): void {
    this.deleting.set(false);
    this.confirming.set(null);
    this.status.set(text);
    this.preview.set(null);
    this.refresh();
  }

  private deleteFailed(): void {
    this.deleting.set(false);
    this.deleteError.set(true);
  }

  // ---- apply to all: first how many change, then the change

  check(): void {
    this.previewState.set('loading');
    this.applyError.set(false);
    this.service.apply(true).subscribe({
      next: preview => {
        this.preview.set(preview);
        this.previewState.set('idle');
      },
      error: () => this.previewState.set('error')
    });
  }

  previewLines(p: Applied): string[] {
    const lines: string[] = [];
    const add = (count: number, one: MessageKey, many: MessageKey) => {
      if (count > 0) {
        lines.push(count === 1 ? this.i18n.t(one) : this.i18n.t(many, {count}));
      }
    };
    add(p.categorized, 'costs.preview.categorized.one', 'costs.preview.categorized');
    add(p.changed, 'costs.preview.changed.one', 'costs.preview.changed');
    add(p.cleared, 'costs.preview.cleared.one', 'costs.preview.cleared');
    add(p.manualKept, 'costs.preview.manual.one', 'costs.preview.manual');
    return lines;
  }

  apply(): void {
    this.applying.set(true);
    this.applyError.set(false);
    this.service.apply(false).subscribe({
      next: done => {
        this.applying.set(false);
        this.preview.set(null);
        this.status.set(done.total === 1 ? this.i18n.t('costs.applied.one') : this.i18n.t('costs.applied', {count: done.total}));
        this.refresh();
      },
      error: () => {
        this.applying.set(false);
        this.applyError.set(true);
      }
    });
  }
}
