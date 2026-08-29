import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent],
  template: `
    <app-navbar *ngIf="auth.isLoggedIn"></app-navbar>
    <router-outlet></router-outlet>
  `,
  styles: [`:host { display: block; min-height: 100vh; position: relative; z-index: 1; }`]
})
export class AppComponent {
  constructor(public auth: AuthService) {}
}
