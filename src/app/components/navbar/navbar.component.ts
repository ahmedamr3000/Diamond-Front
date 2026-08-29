import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  constructor(public auth: AuthService, private router: Router) {}

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
