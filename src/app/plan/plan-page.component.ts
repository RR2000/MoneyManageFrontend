import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {IconComponent} from '../ui/icon.component';
import {PlanTrackingComponent} from './plan-tracking.component';
import {PlanVersionsComponent} from './plan-versions.component';
import {PlanProjectionComponent} from './plan-projection.component';
import {PlanResultsComponent} from './plan-results.component';
import {
  configOf, DraftErrors, draftOf, EventDraft, EventKind, hasErrors, isoDay, MAX_LABEL, MAX_NAME, MonteCarlo,
  MoneyInputs, newDraft, PlanDraft, PlanField, PlanService, PlansOverview, PlanView, Projection, sameDraft,
  SERVER_ERRORS, validate
} from './plan.service';

/** after the last key, before asking the server for the new numbers */
export const RECALC_DELAY_MS = 400;

type MoneyField = 'startValue' | 'invested' | 'monthly';
const OWN: Record<MoneyField, 'startValueOwn' | 'investedOwn' | 'monthlyOwn'> = {
  startValue: 'startValueOwn', invested: 'investedOwn', monthly: 'monthlyOwn'
};
const MONEY: Record<MoneyField, 'value' | 'invested' | 'monthly'> = {
  startValue: 'value', invested: 'invested', monthly: 'monthly'
};

/**
 * /plan and /plan/:id, the plan of the investments (in place of a spreadsheet): the inputs, from money or the user's
 * own, the scenarios and the events; what it gives at the target date before and after taxes and in euro of today; the
 * projection with the band from prudent to optimistic (or from Monte Carlo), and as a table; planned against real; the
 * saved versions. Every change asks the server for the numbers again after a short pause, and says so while it waits.
 */
@Component({
  selector: 'app-plan-page',
  imports: [FormsModule, TPipe, PageHeaderComponent, LoadStateComponent, IconComponent, PlanTrackingComponent,
    PlanVersionsComponent, PlanProjectionComponent, PlanResultsComponent],
  templateUrl: './plan-page.component.html',
  styleUrl: './plan-page.component.css'
})
export class PlanPageComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private service = inject(PlanService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly maxName = MAX_NAME;
  readonly maxLabel = MAX_LABEL;
  readonly kinds: EventKind[] = ['ONE_OFF', 'MONTHLY'];
  readonly scenarioFields = [
    {field: 'ratePrudent', key: 'PRUDENT'},
    {field: 'rateBase', key: 'BASE'},
    {field: 'rateOptimistic', key: 'OPTIMISTIC'}
  ] as const;

  readonly state = signal<LoadState>('loading');
  readonly overview = signal<PlansOverview | null>(null);
  /** the plan on screen; null while creating a new one */
  readonly plan = signal<PlanView | null>(null);
  readonly creating = signal(false);
  today = isoDay(new Date());

  /** the form (ngModel writes into it); `rev` changes at every change so the computed values follow */
  form: PlanDraft | null = null;
  private loaded: PlanDraft | null = null;
  readonly rev = signal(0);

  readonly projection = signal<Projection | null>(null);
  readonly projState = signal<LoadState>('ready');
  /** a new projection is on its way (the pause after a key, or the call) */
  readonly pending = signal(false);
  readonly view = signal<'scenarios' | 'mc'>('scenarios');
  readonly mc = signal<MonteCarlo | null>(null);
  readonly mcState = signal<LoadState>('ready');
  private mcFor = '';

  readonly saving = signal(false);
  readonly saveError = signal<MessageKey | null>(null);
  readonly serverErrors = signal<Partial<Record<PlanField, MessageKey>>>({});
  readonly saved = signal<string>('');

  readonly duplicating = signal(false);
  dupName = '';
  readonly dupBusy = signal(false);
  readonly dupError = signal<MessageKey | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal(false);
  readonly versionLoading = signal<number | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private call?: Subscription;
  private load$?: Subscription;
  private routeSub?: Subscription;

  readonly money = computed<MoneyInputs | null>(() => this.plan()?.money ?? this.overview()?.money ?? null);
  readonly currency = computed(() => this.money()?.currency ?? 'EUR');

  readonly errors = computed<DraftErrors>(() => {
    this.rev();
    return this.form ? validate(this.form, this.today) : {fields: {}, events: []};
  });

  readonly dirty = computed(() => {
    this.rev();
    return !!this.form && (!this.loaded || !sameDraft(this.form, this.loaded));
  });

  /** the plan, or the new one, has something to show */
  readonly ready = computed(() => this.state() === 'ready' && !!this.form);

  readonly title = computed(() => {
    this.rev();
    return this.form?.name.trim() || this.i18n.t('nav.plan');
  });

  readonly subtitle = computed(() => {
    this.i18n.lang();
    const p = this.plan();
    if (this.creating() || !p) {
      return this.i18n.t('plan.subtitle.draft');
    }
    const text = this.i18n.t('plan.subtitle.version', {number: p.version.number, date: this.i18n.date(p.version.savedOn)});
    return this.dirty() ? `${text} · ${this.i18n.t('plan.subtitle.unsaved')}` : text;
  });

  /** the tax and the inflation of the projection on screen */
  readonly projectedWith = signal({taxRate: 0, inflation: 0});

  readonly historical = computed(() => {
    this.i18n.lang();
    const m = this.money();
    if (!m || m.historicalRate === null || !m.since) {
      return this.i18n.t('plan.historical.none');
    }
    return this.i18n.t('plan.historical.value', {rate: this.pct(m.historicalRate), since: this.i18n.month(m.since)});
  });

  readonly plans = computed(() => this.overview()?.plans ?? []);

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      this.load(id === null ? null : Number(id));
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.call?.unsubscribe();
    this.load$?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  /** the plans (and money's values), then the plan asked for, or the one saved last */
  load(id: number | null = this.plan()?.id ?? null): void {
    this.state.set('loading');
    this.load$?.unsubscribe();
    this.closeAll();
    this.load$ = this.service.overview().subscribe({
      next: overview => {
        this.overview.set(overview);
        const wanted = id !== null && overview.plans.some(p => p.id === id) ? id : overview.plans[0]?.id ?? null;
        if (wanted === null) {
          this.plan.set(null);
          this.form = null;
          this.creating.set(false);
          this.state.set('empty');
          return;
        }
        this.openVersion(wanted, null);
      },
      error: () => this.state.set('error')
    });
  }

  /** a version of a plan (null: the one in use) */
  openVersion(id: number, version: number | null): void {
    if (this.state() === 'ready') {
      this.versionLoading.set(version ?? 0);
    }
    this.load$?.unsubscribe();
    this.load$ = this.service.get(id, version).subscribe({
      next: view => {
        this.versionLoading.set(null);
        this.show(view);
      },
      error: () => {
        this.versionLoading.set(null);
        this.state.set('error');
      }
    });
  }

  private show(view: PlanView): void {
    this.plan.set(view);
    this.creating.set(false);
    this.form = draftOf(view.name, view.version.config, view.latest ? view.money : null);
    this.loaded = structuredClone(this.form);
    this.projection.set(view.projection);
    this.projectedWith.set({taxRate: view.version.config.taxRate, inflation: view.version.config.inflation});
    this.projState.set('ready');
    this.mc.set(null);
    this.mcFor = '';
    this.serverErrors.set({});
    this.saveError.set(null);
    this.state.set('ready');
    this.bump();
    if (this.view() === 'mc') {
      this.runProjection();
    }
  }

  /** "Create the plan": a form filled with money's values, not saved until "Save" */
  create(): void {
    const money = this.overview()?.money;
    if (!money) {
      return;
    }
    this.plan.set(null);
    this.creating.set(true);
    this.form = newDraft(this.i18n.t('plan.defaultName'), money, this.today);
    this.loaded = null;
    this.projection.set(null);
    this.mc.set(null);
    this.mcFor = '';
    this.state.set('ready');
    this.bump();
    this.runProjection();
  }

  // ---- the form

  /** after any change: the errors again, and the numbers after a short pause */
  changed(): void {
    this.bump();
    this.saved.set('');
    this.serverErrors.set({});
    this.saveError.set(null);
    this.clearTimer();
    if (hasErrors(this.errors())) {
      this.pending.set(false);
      this.call?.unsubscribe();
      return;
    }
    this.pending.set(true);
    this.timer = setTimeout(() => this.runProjection(), RECALC_DELAY_MS);
  }

  /** typing in an input that came from money makes it the user's own */
  typed(field: MoneyField): void {
    this.form![OWN[field]] = true;
    this.changed();
  }

  /** back to money's value */
  useMoney(field: MoneyField): void {
    const money = this.money();
    if (!money || !this.form) {
      return;
    }
    this.form[field] = money[MONEY[field]];
    this.form[OWN[field]] = false;
    this.changed();
  }

  own(field: MoneyField): boolean {
    this.rev();
    return !!this.form?.[OWN[field]];
  }

  /** money's value differs from the one in the form */
  differs(field: MoneyField): boolean {
    this.rev();
    const money = this.money();
    return !!money && !!this.form && this.form[field] !== money[MONEY[field]];
  }

  addEvent(): void {
    const next = new Date();
    next.setDate(1);
    next.setMonth(next.getMonth() + 12);
    this.form!.events.push({kind: 'ONE_OFF', date: isoDay(next), amount: null, label: ''});
    this.changed();
  }

  removeEvent(index: number): void {
    this.form!.events.splice(index, 1);
    this.changed();
  }

  trackEvent(index: number, _e: EventDraft): number {
    return index;
  }

  fieldError(field: PlanField): MessageKey | null {
    return this.errors().fields[field] ?? this.serverErrors()[field] ?? null;
  }

  eventError(index: number, part: 'date' | 'amount' | 'label'): MessageKey | null {
    return this.errors().events[index]?.[part] ?? null;
  }

  rateError(): MessageKey | null {
    const f = this.errors().fields;
    return f.ratePrudent ?? f.rateBase ?? f.rateOptimistic ?? f.rates ?? this.serverErrors().rates ?? null;
  }

  readonly invalid = computed(() => hasErrors(this.errors()));

  // ---- the numbers

  setView(view: 'scenarios' | 'mc'): void {
    this.view.set(view);
    if (view === 'mc' && this.form && !hasErrors(this.errors()) && this.mcFor !== this.key()) {
      this.clearTimer();
      this.runProjection();
    }
  }

  private key(): string {
    return JSON.stringify(configOf(this.form!));
  }

  runProjection(): void {
    this.clearTimer();
    if (!this.form || hasErrors(this.errors())) {
      this.pending.set(false);
      return;
    }
    const withMc = this.view() === 'mc';
    const key = this.key();
    const config = configOf(this.form);
    this.pending.set(true);
    if (withMc) {
      this.mcState.set('loading');
    }
    this.call?.unsubscribe();
    this.call = this.service.project(config, withMc).subscribe({
      next: p => {
        this.projection.set(p);
        this.projectedWith.set({taxRate: config.taxRate, inflation: config.inflation});
        this.projState.set('ready');
        if (withMc) {
          this.mc.set(p.monteCarlo);
          this.mcFor = key;
          this.mcState.set('ready');
        } else if (this.mcFor !== key) {
          this.mc.set(null);
          this.mcFor = '';
        }
        this.pending.set(false);
      },
      error: () => {
        this.projState.set('error');
        if (withMc) {
          this.mcState.set('error');
        }
        this.pending.set(false);
      }
    });
  }

  // ---- saving

  save(): void {
    if (!this.form || this.saving()) {
      return;
    }
    if (hasErrors(this.errors())) {
      this.saveError.set('plan.error.fix');
      return;
    }
    const name = this.form.name.trim().replace(/\s+/g, ' ');
    const config = configOf(this.form);
    const p = this.plan();
    this.saving.set(true);
    this.saveError.set(null);
    const call = this.creating() || !p ? this.service.create(name, config) : this.service.save(p.id, name, config);
    call.subscribe({
      next: view => {
        this.saving.set(false);
        const isNew = this.creating() || !p;
        this.show(view);
        this.saved.set(this.i18n.t('plan.saved', {number: view.version.number}));
        this.refreshList(view);
        if (isNew) {
          this.router.navigate(['/plan', view.id], {replaceUrl: true});
        }
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.serverError(e, this.saveError, true);
      }
    });
  }

  private serverError(e: HttpErrorResponse, target: typeof this.saveError, fields: boolean): void {
    const code = e.status === 400 && typeof e.error?.message === 'string' ? e.error.message : '';
    const known = SERVER_ERRORS[code];
    if (known && known.field && fields) {
      this.serverErrors.set({[known.field]: known.key});
      target.set('plan.error.fix');
    } else {
      target.set(known?.key ?? 'common.failed');
    }
  }

  /** the list of the plans after a save (the name may have changed), without loading the page again */
  private refreshList(view: PlanView): void {
    const overview = this.overview();
    if (!overview) {
      return;
    }
    const summary = {id: view.id, name: view.name, versions: view.versions.length, savedAt: view.version.savedAt,
      targetDate: view.version.config.targetDate, tracking: view.tracking};
    this.overview.set({...overview, plans: [summary, ...overview.plans.filter(p => p.id !== view.id)]});
  }

  // ---- other plans

  switchTo(id: string): void {
    this.router.navigate(['/plan', Number(id)]);
  }

  openDuplicate(): void {
    this.dupName = this.i18n.t('plan.duplicate.default', {name: this.form?.name.trim() ?? ''}).substring(0, MAX_NAME);
    this.dupError.set(null);
    this.duplicating.set(true);
  }

  duplicate(): void {
    if (!this.form || this.dupBusy()) {
      return;
    }
    const name = this.dupName.trim().replace(/\s+/g, ' ');
    if (!name) {
      this.dupError.set('plan.error.name');
      return;
    }
    if (name.length > MAX_NAME) {
      this.dupError.set('plan.error.nameLong');
      return;
    }
    if (hasErrors(this.errors())) {
      this.dupError.set('plan.error.fix');
      return;
    }
    this.dupBusy.set(true);
    this.service.create(name, configOf(this.form)).subscribe({
      next: view => {
        this.dupBusy.set(false);
        this.duplicating.set(false);
        this.refreshList(view);
        this.router.navigate(['/plan', view.id]);
      },
      error: (e: HttpErrorResponse) => {
        this.dupBusy.set(false);
        this.serverError(e, this.dupError, false);
      }
    });
  }

  deletePlan(): void {
    const p = this.plan();
    if (!p || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set(false);
    this.service.delete(p.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.plan.set(null);
        this.router.navigate(['/plan']).then(() => this.load(null));
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set(true);
      }
    });
  }

  // ---- words

  pct(value: number): string {
    return this.i18n.percent(value / 100, 2);
  }

  moneyHint(field: MoneyField): string {
    this.i18n.lang();
    const m = this.money();
    if (!m) {
      return '';
    }
    switch (field) {
      case 'startValue':
        return this.i18n.t('plan.hint.start', {date: this.i18n.date(m.date)});
      case 'invested':
        return this.i18n.t('plan.hint.invested');
      default:
        return m.monthlyMonths > 0 ? this.i18n.t(m.monthlyMonths === 1 ? 'plan.hint.monthly.one' : 'plan.hint.monthly',
          {count: m.monthlyMonths}) : this.i18n.t('plan.hint.monthly.none');
    }
  }

  moneyValue(field: MoneyField): string {
    const m = this.money();
    return m ? this.i18n.money(m[MONEY[field]], m.currency, field === 'monthly' ? 0 : 0) : '';
  }

  emptyText(): string {
    const m = this.overview()?.money;
    if (!m || m.value <= 0) {
      return this.i18n.t('plan.empty.noData');
    }
    return this.i18n.t('plan.empty', {value: this.i18n.money(m.value, m.currency, 0),
      monthly: this.i18n.money(m.monthly, m.currency, 0)});
  }

  private bump(): void {
    this.rev.update(n => n + 1);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private closeAll(): void {
    this.duplicating.set(false);
    this.saved.set('');
  }
}
