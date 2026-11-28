import {Component} from '@angular/core';
import {RealEstateComponent} from '../real-estate/real-estate.component';
import {PageHeaderComponent} from '../ui/page-header.component';
import {TPipe} from '../i18n/t.pipe';

/** /assets: real estate for now; other assets and debts come next. */
@Component({
  selector: 'app-assets-page',
  imports: [PageHeaderComponent, RealEstateComponent, TPipe],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.assets' | t"/>
      <app-real-estate></app-real-estate>
    </div>`
})
export class AssetsPageComponent {
}
