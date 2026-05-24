import {Component} from '@angular/core';
import {Router, RouterOutlet} from '@angular/router';
import {NgIf} from '@angular/common';
import {AuthService} from './auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    RouterOutlet,
    NgIf
  ],
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(private auth: AuthService, private router: Router) {
  }

  isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
