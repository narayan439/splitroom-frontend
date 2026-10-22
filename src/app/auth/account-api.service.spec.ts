import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AccountApiService } from './account-api.service';

describe('AccountApiService', () => {
  let service: AccountApiService;
  let httpTesting: HttpTestingController;
  const accountUrl = `${environment.apiUrl.replace(/\/+$/, '')}/api/users/me`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AccountApiService,
      ],
    });
    service = TestBed.inject(AccountApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('updates profile details and expects the refreshed authenticated session', () => {
    const request = {
      name: 'Jordan Smith',
      email: 'jordan@example.com',
      phone: '9876543210',
    };
    const response = {
      tokenType: 'Bearer' as const,
      accessToken: 'refreshed-token',
      expiresInSeconds: 3600,
      user: { userId: 7, ...request },
    };

    service.updateProfile(request).subscribe((result) => {
      expect(result).toEqual(response);
    });

    const httpRequest = httpTesting.expectOne(accountUrl);
    expect(httpRequest.request.method).toBe('PUT');
    expect(httpRequest.request.body).toEqual(request);
    httpRequest.flush(response);
  });

  it('changes the password through the authenticated account endpoint', () => {
    const request = {
      currentPassword: 'current-password',
      newPassword: 'new-password-123',
    };

    service.changePassword(request).subscribe();

    const httpRequest = httpTesting.expectOne(`${accountUrl}/password`);
    expect(httpRequest.request.method).toBe('PUT');
    expect(httpRequest.request.body).toEqual(request);
    httpRequest.flush(null);
  });
});
