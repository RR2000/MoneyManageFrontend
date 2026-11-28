import {Routes} from '@angular/router';
import {MainComponentComponent} from './main-component/main-component.component';
import {LoginComponent} from './login/login.component';
import {SetupWizardComponent} from './setup-wizard/setup-wizard.component';
import {authGuard} from './auth/auth.guard';
import {ForgotPasswordComponent} from './forgot-password/forgot-password.component';
import {ResetPasswordComponent} from './reset-password/reset-password.component';
import {VerifyEmailComponent} from './verify-email/verify-email.component';
import {AccountComponent} from './account/account.component';
import {BanksComponent} from './banks/banks.component';
import {MoneyAccountsComponent} from './money-accounts/money-accounts.component';
import {InvestmentsPageComponent} from './pages/investments-page.component';
import {AssetsPageComponent} from './pages/assets-page.component';
import {PlanPageComponent} from './pages/plan-page.component';
import {MoreComponent} from './pages/more.component';

/** One address per section (see nav.ts for the menus). */
export const routes: Routes = [
  {path: 'login', component: LoginComponent},
  // links from the emails, with the token in the fragment
  {path: 'forgot-password', component: ForgotPasswordComponent},
  {path: 'reset-password', component: ResetPasswordComponent},
  {path: 'verify-email', component: VerifyEmailComponent},
  {path: '', component: MainComponentComponent, canActivate: [authGuard]},
  // the money accounts: where their rows come from, delete one
  {path: 'accounts', component: MoneyAccountsComponent, canActivate: [authGuard]},
  {path: 'investments', component: InvestmentsPageComponent, canActivate: [authGuard]},
  {path: 'plan', component: PlanPageComponent, canActivate: [authGuard]},
  {path: 'assets', component: AssetsPageComponent, canActivate: [authGuard]},
  // open banking; the backend sends the browser back here with ?result=ok|error
  {path: 'banks', component: BanksComponent, canActivate: [authGuard]},
  {path: 'import', component: SetupWizardComponent, canActivate: [authGuard]},
  {path: 'settings', component: AccountComponent, canActivate: [authGuard]},
  {path: 'more', component: MoreComponent, canActivate: [authGuard]},
  // old addresses, still in bookmarks and in emails already sent
  {path: 'setup', redirectTo: 'import'},
  {path: 'account', redirectTo: 'settings'},
  {path: '**', redirectTo: ''}
];
