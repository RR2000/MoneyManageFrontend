import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent, IconName} from './icon.component';
import {MessageKey} from '../i18n/messages.en';

export type MovementSource = 'BANK' | 'FILE' | 'MANUAL';

const ICON: Record<MovementSource, IconName> = {BANK: 'bank', FILE: 'file', MANUAL: 'hand'};

/** Where a movement comes from: bank, file or by hand, as icon and word. */
@Component({
  selector: 'app-source-tag',
  imports: [TPipe, IconComponent],
  template: `<app-icon [name]="icon()"/><span>{{ label() | t }}</span><span class="sr-only">: {{ title() | t }}</span>`,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; line-height: 1.6; border-radius: 5px;
      padding: 0 6px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; --icon-size: 12px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SourceTagComponent {
  readonly source = input.required<MovementSource>();
  readonly icon = computed(() => ICON[this.source()] ?? 'file');
  readonly label = computed(() => `source.${this.source()}` as MessageKey);
  readonly title = computed(() => `source.${this.source()}.title` as MessageKey);
}
