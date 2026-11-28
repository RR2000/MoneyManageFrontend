import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {THEME_MODES, ThemeMode, ThemeService} from './theme.service';
import {IconComponent, IconName} from '../ui/icon.component';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';

const ICON: Record<ThemeMode, IconName> = {system: 'monitor', light: 'sun', dark: 'moon'};
const LABEL: Record<ThemeMode, MessageKey> = {system: 'theme.system', light: 'theme.light', dark: 'theme.dark'};

/** System / light / dark, three buttons with icon and text (the pressed one is also said, not only coloured). */
@Component({
  selector: 'app-theme-switch',
  imports: [IconComponent, TPipe],
  template: `
    <div class="seg" role="group" [attr.aria-label]="'theme.label' | t">
      @for (mode of modes; track mode) {
        <button type="button" [attr.aria-pressed]="theme.mode() === mode" (click)="theme.set(mode)"
                [attr.title]="label[mode] | t">
          <app-icon [name]="icon[mode]"/>
          <span [class.sr-only]="compact()">{{ label[mode] | t }}</span>
        </button>
      }
    </div>`,
  styles: [`
    .seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 8px; overflow: hidden;
      background: var(--surface); }
    .seg button { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 0; margin: 0;
      background: transparent; color: var(--fg); padding: 4px 10px; min-height: 44px; min-width: 44px;
      justify-content: center; cursor: pointer; --icon-size: 16px; }
    .seg button + button { border-left: 1px solid var(--line); }
    .seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-fg); font-weight: 600; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSwitchComponent {
  readonly theme = inject(ThemeService);
  readonly modes = THEME_MODES;
  readonly icon = ICON;
  readonly label = LABEL;
  /** only the icons, the names for screen readers and as tooltip */
  readonly compact = input(false);
}
