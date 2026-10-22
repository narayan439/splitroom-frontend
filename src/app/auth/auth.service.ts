import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from './auth.models';
import { AuthApiService } from './auth-api.service';

interface StoredSession {
  accessToken: string;
  expiresAt: number;
  user: UserResponse;
}

const SESSION_KEY = 'splitroom.auth.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly sessionSubject = new BehaviorSubject<StoredSession | null>(
    this.readStoredSession()
  );
  private readonly userSubject = new BehaviorSubject<UserResponse | null>(
    this.sessionSubject.value?.user ?? null
  );

  readonly currentUser$ = this.userSubject.asObservable();
  readonly isAuthenticated$ = this.sessionSubject.asObservable().pipe(
    map((session) => session !== null && session.expiresAt > Date.now())
  );

  register(request: RegisterRequest): Observable<UserResponse> {
    return this.authApi.register(request);
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.authApi
      .login(request)
      .pipe(tap((response) => this.saveSession(response)));
  }

  replaceSession(response: AuthResponse): void {
    this.saveSession(response);
  }

  isAuthenticated(): boolean {
    return this.getValidSession() !== null;
  }

  get isAuthenticatedState(): boolean {
    return this.isAuthenticated();
  }

  get currentUser(): UserResponse | null {
    return this.getCurrentUser();
  }

  getCurrentUser(): UserResponse | null {
    return this.getValidSession()?.user ?? null;
  }

  getAccessToken(): string | null {
    return this.getValidSession()?.accessToken ?? null;
  }

  logout(returnUrl?: string): void {
    this.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: returnUrl ? { returnUrl } : undefined,
    });
  }

  handleUnauthorized(returnUrl: string): void {
    this.clearSession();
    if (returnUrl.startsWith('/login') || returnUrl.startsWith('/register')) {
      return;
    }
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl },
    });
  }

  private saveSession(response: AuthResponse): void {
    if (
      !response.accessToken ||
      response.tokenType !== 'Bearer' ||
      !response.user ||
      !Number.isFinite(response.expiresInSeconds) ||
      response.expiresInSeconds <= 0
    ) {
      throw new Error('The authentication response was incomplete.');
    }

    const session: StoredSession = {
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresInSeconds * 1000,
      user: response.user,
    };
    this.sessionSubject.next(session);
    this.userSubject.next(session.user);
    if (this.isBrowser) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  private clearSession(): void {
    this.sessionSubject.next(null);
    this.userSubject.next(null);
    if (this.isBrowser) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  private getValidSession(): StoredSession | null {
    const session = this.sessionSubject.value;
    if (!session) {
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      this.clearSession();
      return null;
    }
    return session;
  }

  private readStoredSession(): StoredSession | null {
    if (!this.isBrowser) {
      return null;
    }
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) {
      return null;
    }

    try {
      const session = JSON.parse(stored) as StoredSession;
      if (
        typeof session.accessToken !== 'string' ||
        typeof session.expiresAt !== 'number' ||
        !session.user ||
        typeof session.user.userId !== 'number' ||
        typeof session.user.email !== 'string'
      ) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      if (session.expiresAt <= Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
