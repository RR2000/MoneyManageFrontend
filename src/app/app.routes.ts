import {Routes} from '@angular/router';
import {MainComponentComponent} from './main-component/main-component.component';
import {SetupWizardComponent} from './setup-wizard/setup-wizard.component';

export const routes: Routes = [
  {path: '', component: MainComponentComponent},
  {path: 'setup', component: SetupWizardComponent},
];
