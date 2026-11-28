import {Component} from '@angular/core';
import {RealEstateComponent} from '../real-estate/real-estate.component';
import {TPipe} from '../i18n/t.pipe';

/** /assets: real estate for now; other assets and debts come next. */
@Component({
  selector: 'app-assets-page',
  imports: [RealEstateComponent, TPipe],
  template: `
    <div class="page">
      <h1>{{ 'nav.assets' | t }}</h1>
      <app-real-estate></app-real-estate>
    </div>`,
  styles: ['h1 { font-size: 1.5rem; margin: 4px 0 4px; }']
})
export class AssetsPageComponent {
}
