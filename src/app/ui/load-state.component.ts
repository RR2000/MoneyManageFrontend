import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from './icon.component';

export type LoadState = 'loading' | 'error' | 'empty' | 'ready';

/**
 * What a box shows when its data is not on screen: a skeleton at once while it loads, the reason and "Retry" when the
 * call failed, a sentence and the action that fills it when there is nothing yet (projected). Shows nothing when
 * `state` is 'ready'. Use it next to the content: `@if (state() === 'ready') {...} @else {<app-load-state/>}`.
 */
@Component({
  selector: 'app-load-state',
  imports: [TPipe, IconComponent],
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="skel" role="status" [attr.aria-label]="'state.loading' | t">
          @if (shape() === 'chart') {
            <i class="area"></i>
          } @else {
            @for (line of lines; track $index) {
              <i [style.width.%]="line"></i>
            }
          }
        </div>
      }
      @case ('error') {
        <div class="box error" role="alert">
          <app-icon name="error"/>
          <span class="text">{{ errorText() || ('common.loadFailed' | t) }}</span>
          <button type="button" (click)="retry.emit()">{{ 'common.retry' | t }}</button>
        </div>
      }
      @case ('empty') {
        <div class="box empty">
          <app-icon name="info"/>
          <span class="text">{{ emptyText() || ('state.empty' | t) }}</span>
          <ng-content/>
        </div>
      }
    }`,
  styles: [`
    :host { display: block; min-width: 0; }
    .skel { display: grid; gap: 10px; padding: 6px 0; }
    .skel i { display: block; height: 12px; border-radius: 6px;
      background: linear-gradient(90deg, var(--surface-2), var(--line), var(--surface-2)); background-size: 200% 100%;
      animation: sh 1.4s linear infinite; }
    .skel i.area { height: var(--skeleton-height, 200px); border-radius: 8px; }
    @keyframes sh { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .skel i { animation: none; } }
    .box { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 14px; border-radius: 10px; }
    .box .text { flex: 1 1 14rem; min-width: 0; }
    .error { background: var(--bad-bg); color: var(--bad); border: 1px solid var(--bad); }
    .error button { padding: 4px 14px; min-height: 36px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .empty { background: var(--surface-2); color: var(--fg); }
    .empty app-icon { color: var(--accent); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadStateComponent {
  readonly state = input.required<LoadState>();
  /** 'lines' for lists and text, 'chart' for a chart */
  readonly shape = input<'lines' | 'chart'>('lines');
  readonly errorText = input('');
  readonly emptyText = input('');
  readonly retry = output<void>();
  readonly lines = [92, 70, 84, 56, 76];
}
