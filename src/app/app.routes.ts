import {Routes} from '@angular/router';
import {MainComponentComponent} from './main-component/main-component.component';
import {LoginComponent} from './login/login.component';
import {authGuard} from './auth/auth.guard';

export const routes: Routes = [
  {path: 'login', component: LoginComponent},
  {path: '', component: MainComponentComponent, canActivate: [authGuard]},
  {path: '**', redirectTo: ''}
];
