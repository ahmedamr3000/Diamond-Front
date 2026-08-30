import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, catchError, of } from 'rxjs';
import { User, DEFAULT_USERS } from '../models/user.model';
import { STEPS_CONFIG } from '../models/order.model';
import { environment } from '../../environments/environment';

function getApiUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://diamond-back-end-wine.vercel.app/api';
  }
  return (environment.apiUrl || 'http://localhost:5000/api').replace(/\/+$/, '');
}

const API_URL = getApiUrl();

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.restoreSession();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  login(username: string, password: string): Observable<User | null> {
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    return this.http.post<{ success: boolean; user: User }>(`${API_URL}/auth/login`, { username: trimmedUsername, password: trimmedPassword }).pipe(
      map(res => {
        if (res.success && res.user) {
          this.currentUserSubject.next(res.user);
          sessionStorage.setItem('gw_session', JSON.stringify(res.user));
          return res.user;
        }
        return null;
      }),
      catchError(() => {
        // Fallback for direct browser preview or when backend proxy is waiting for restart
        const local = DEFAULT_USERS.find(
          u => u.username.toLowerCase() === trimmedUsername && u.password === trimmedPassword
        );
        if (local) {
          const { password: _, icon: __, ...safeUser } = local;
          this.currentUserSubject.next(safeUser);
          sessionStorage.setItem('gw_session', JSON.stringify(safeUser));
          return of(safeUser);
        }
        return of(null);
      })
    );
  }

  logout(): void {
    this.currentUserSubject.next(null);
    sessionStorage.removeItem('gw_session');
  }

  canCreateOrder(): boolean {
    return this.currentUser?.role === 'admin';
  }

  canDeleteOrder(): boolean {
    return this.currentUser?.role === 'admin';
  }

  canCompleteStep(stepId: string): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin') return true;
    const step = STEPS_CONFIG.find(s => s.id === stepId);
    if (!step) return false;
    if (step.allowedRoles && step.allowedRoles.includes(this.currentUser.role)) return true;
    return this.currentUser.role === step.allowedRole;
  }

  private restoreSession(): void {
    try {
      const session = sessionStorage.getItem('gw_session');
      if (session) {
        const user = JSON.parse(session) as User;
        this.currentUserSubject.next(user);
      }
    } catch {
      sessionStorage.removeItem('gw_session');
    }
  }
}
