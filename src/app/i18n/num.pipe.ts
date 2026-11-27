import {inject, Pipe, PipeTransform} from '@angular/core';
import {I18nService} from './i18n.service';

/** `{{ amount | num }}` (two decimals), `{{ price | num: 2: 4 }}` (two to four): the number in the format of the language. */
@Pipe({name: 'num', pure: false})
export class NumPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(value: number | null | undefined, decimals = 2, maxDecimals = decimals): string {
    return value === null || value === undefined || isNaN(value) ? '' : this.i18n.number(value, decimals, maxDecimals);
  }
}
