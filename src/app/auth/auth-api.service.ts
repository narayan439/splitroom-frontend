import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly authUrl = `${environment.apiUrl.replace(/\/+$/, '')}/api/auth`;

  register(request: RegisterRequest): Observable<UserResponse> {
    return this.http
      .post<UserResponse>(`${this.authUrl}/register`, request)
      .pipe(timeout({ first: 20_000 }));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.authUrl}/login`, request)
      .pipe(timeout({ first: 20_000 }));
  }
}
