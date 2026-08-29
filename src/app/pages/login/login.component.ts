import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DEFAULT_USERS, UserAccount } from '../../models/user.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';
  showError = false;
  isLoading = false;
  accounts = DEFAULT_USERS;

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    }
  }

  clearError(): void {
    this.showError = false;
  }

  selectAccount(acc: UserAccount): void {
    this.username = acc.username;
    this.password = acc.password;
    this.onSubmit();
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password.trim()) return;

    this.isLoading = true;
    this.showError = false;

    this.auth.login(this.username, this.password).subscribe(user => {
      this.isLoading = false;
      if (user) {
        this.router.navigate(['/dashboard']);
      } else {
        this.showError = true;
        this.errorMessage = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        this.password = '';
      }
    });
  }
}

