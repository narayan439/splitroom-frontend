import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpTesting: HttpTestingController;
  const authUrl = `${environment.apiUrl.replace(/\/+$/, '')}/api/auth`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthApiService,
      ],
    });
    service = TestBed.inject(AuthApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('posts the registration DTO without adding a role', () => {
    const request = {
      name: 'Narayan',
      email: 'narayan@example.com',
      phone: '9876543210',
      password: 'StrongPassword123',
    };

    service.register(request).subscribe();

    const httpRequest = httpTesting.expectOne(`${authUrl}/register`);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);
    expect(httpRequest.request.body.role).toBeUndefined();
    httpRequest.flush({
      userId: 1,
      name: request.name,
      email: request.email,
      phone: request.phone,
    });
  });

  it('posts login credentials and expects the backend auth response shape', () => {
    const request = {
      email: 'narayan@example.com',
      password: 'StrongPassword123',
    };

    service.login(request).subscribe((response) => {
      expect(response.tokenType).toBe('Bearer');
      expect(response.accessToken).toBe('signed-token');
      expect(response.expiresInSeconds).toBe(3600);
      expect(response.user.userId).toBe(1);
    });

    const httpRequest = httpTesting.expectOne(`${authUrl}/login`);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);
    httpRequest.flush({
      tokenType: 'Bearer',
      accessToken: 'signed-token',
      expiresInSeconds: 3600,
      user: {
        userId: 1,
        name: 'Narayan',
        email: request.email,
        phone: '9876543210',
      },
    });
  });
});
