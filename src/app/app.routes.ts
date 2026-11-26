import {Routes} from '@angular/router';
import {MainComponentComponent} from './main-component/main-component.component';
import {LoginComponent} from './login/login.component';
import {SetupWizardComponent} from './setup-wizard/setup-wizard.component';
import {authGuard} from './auth/auth.guard';
import {ForgotPasswordComponent} from './forgot-password/forgot-password.component';
import {ResetPasswordComponent} from './reset-password/reset-password.component';
import {VerifyEmailComponent} from './verify-email/verify-email.component';
import {AccountComponent} from './account/account.component';

export const routes: Routes = [
  {path: 'login', component: LoginComponent},
  // links from the emails, with the token in the fragment
  {path: 'forgot-password', component: ForgotPasswordComponent},
  {path: 'reset-password', component: ResetPasswordComponent},
  {path: 'verify-email', component: VerifyEmailComponent},
  {path: 'account', component: AccountComponent, canActivate: [authGuard]},
  {path: '', component: MainComponentComponent, canActivate: [authGuard]},
  {path: 'setup', component: SetupWizardComponent, canActivate: [authGuard]},
  {path: '**', redirectTo: ''}
];
