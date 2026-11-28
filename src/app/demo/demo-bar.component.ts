import {afterNextRender, Component, DestroyRef, ElementRef, inject} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';
import {DemoService} from './demo.service';

/**
 * The bar on top of every page of a demo sandbox: made-up data that goes away, and the way to a real account. It stays
 * in view (sticky) without covering the page: it takes its own room, and its height goes to --demo-bar-h, which the
 * side bar and the scrolling to a focused field leave free.
 */
@Component({
  selector: 'app-demo-bar',
  imports: [TPipe, IconComponent],
  template: `
    @if (demo.info(); as d) {
      <div class="demo-bar" role="region" [attr.aria-label]="'demo.bar.label' | t">
        <app-icon name="info"/>
        <p><strong>{{ 'demo.bar.title' | t }}</strong> {{ 'demo.bar.text' | t: {hours: d.hours} }}</p>
        <button type="button" class="real" (click)="demo.leave()">{{ 'demo.bar.real' | t }}</button>
      </div>
    }`,
  styles: [`
    :host { display: block; position: sticky; top: 0; z-index: 6; }
    .demo-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 6px 16px;
      background: var(--accent-soft); color: var(--fg); border-bottom: 1px solid var(--line); --icon-size: 18px; }
    .demo-bar app-icon { color: var(--accent); flex: none; }
    p { margin: 0; flex: 1 1 14rem; min-width: 0; overflow-wrap: anywhere; }
    .real { min-height: 44px; padding: 4px 12px; border-radius: 8px; cursor: pointer; font-weight: 600;
      color: var(--accent); background: var(--surface); border: 1px solid var(--accent); }
    .real:hover { background: var(--surface-2); }
  `]
})
export class DemoBarComponent {
  readonly demo = inject(DemoService);
  readonly i18n = inject(I18nService);

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const root = document.documentElement;
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => root.style.setProperty('--demo-bar-h', `${host.offsetHeight}px`));
      observer.observe(host);
      this.destroy = () => observer.disconnect();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroy();
      root.style.removeProperty('--demo-bar-h');
    });
  }

  private destroy: () => void = () => undefined;
}
