import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  ChangePasswordRequest,
  UpdateProfileRequest,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly usersUrl = `${environment.apiUrl.replace(/\/+$/, '')}/api/users/me`;

  updateProfile(request: UpdateProfileRequest): Observable<AuthResponse> {
    return this.http
      .put<AuthResponse>(this.usersUrl, request)
      .pipe(timeout({ first: 20_000 }));
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http
      .put<void>(`${this.usersUrl}/password`, request)
      .pipe(timeout({ first: 20_000 }));
  }
}
