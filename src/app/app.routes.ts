import {Routes} from '@angular/router';
import {LoginComponent} from './login/login.component';
import {ImportPageComponent} from './import/import-page.component';
import {authGuard} from './auth/auth.guard';
import {ForgotPasswordComponent} from './forgot-password/forgot-password.component';
import {ResetPasswordComponent} from './reset-password/reset-password.component';
import {VerifyEmailComponent} from './verify-email/verify-email.component';
import {SettingsPageComponent} from './settings/settings-page.component';
import {BanksComponent} from './banks/banks.component';
import {AccountsPageComponent} from './accounts/accounts-page.component';
import {AccountPageComponent} from './accounts/account-page.component';
import {InvestmentsPageComponent} from './investments/investments-page.component';
import {AssetsPageComponent} from './assets/assets-page.component';
import {PlanPageComponent} from './plan/plan-page.component';
import {MoreComponent} from './pages/more.component';
import {HomeComponent} from './home/home.component';
import {CostsPageComponent} from './costs/costs-page.component';
import {RulesPageComponent} from './costs/rules-page.component';
import {UncategorizedPageComponent} from './costs/uncategorized-page.component';

/** One address per section (see nav.ts for the menus). */
export const routes: Routes = [
  {path: 'login', component: LoginComponent},
  // links from the emails, with the token in the fragment
  {path: 'forgot-password', component: ForgotPasswordComponent},
  {path: 'reset-password', component: ResetPasswordComponent},
  {path: 'verify-email', component: VerifyEmailComponent},
  {path: '', component: HomeComponent, canActivate: [authGuard]},
  // the money accounts, and the page of one (by id, a hash of the name: the name never goes in a URL)
  {path: 'accounts', component: AccountsPageComponent, canActivate: [authGuard]},
  {path: 'accounts/:id', component: AccountPageComponent, canActivate: [authGuard]},
  {path: 'investments', component: InvestmentsPageComponent, canActivate: [authGuard]},
  // fixed costs, the categories and their rules, the movements still without a category
  {path: 'costs', component: CostsPageComponent, canActivate: [authGuard]},
  {path: 'costs/rules', component: RulesPageComponent, canActivate: [authGuard]},
  {path: 'costs/uncategorized', component: UncategorizedPageComponent, canActivate: [authGuard]},
  // the plan saved last, or one by id
  {path: 'plan', component: PlanPageComponent, canActivate: [authGuard]},
  {path: 'plan/:id', component: PlanPageComponent, canActivate: [authGuard]},
  {path: 'assets', component: AssetsPageComponent, canActivate: [authGuard]},
  // open banking; the backend sends the browser back here with ?result=ok|error
  {path: 'banks', component: BanksComponent, canActivate: [authGuard]},
  {path: 'import', component: ImportPageComponent, canActivate: [authGuard]},
  {path: 'settings', component: SettingsPageComponent, canActivate: [authGuard]},
  {path: 'more', component: MoreComponent, canActivate: [authGuard]},
  // old addresses, still in bookmarks and in emails already sent
  {path: 'setup', redirectTo: 'import'},
  {path: 'account', redirectTo: 'settings'},
  // the old dashboard with tabs: every part of it has its own page now
  {path: 'classic', redirectTo: ''},
  {path: '**', redirectTo: ''}
];
