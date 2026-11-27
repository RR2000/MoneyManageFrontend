import {inject, Pipe, PipeTransform} from '@angular/core';
import {I18nService} from './i18n.service';
import {MessageKey} from './messages.en';

/**
 * `{{ 'nav.banks' | t }}`, `{{ 'banks.expiresIn' | t: {days: 3} }}`. Not pure: it reads the language signal, so the
 * texts change as soon as the language does.
 */
@Pipe({name: 't', pure: false})
export class TPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: MessageKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
