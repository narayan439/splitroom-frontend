import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';

describe('authInterceptor', () => {
  let httpTesting: HttpTestingController;
  let http: HttpClient;
  const handleUnauthorized = vi.fn();
  const getAccessToken = vi.fn(() => null as string | null);

  beforeEach(() => {
    handleUnauthorized.mockReset();
    getAccessToken.mockReset();
    getAccessToken.mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken,
            handleUnauthorized,
          },
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => httpTesting.verify());

  it('passes login 401 through without redirecting or swallowing it', () => {
    let receivedError: unknown;
    const loginUrl = `${environment.apiUrl}/api/auth/login`;

    http.post(loginUrl, {}).subscribe({
      error: (error: unknown) => {
        receivedError = error;
      },
    });

    const request = httpTesting.expectOne(loginUrl);
    request.flush(
      { message: 'Invalid email or password' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    expect((receivedError as HttpErrorResponse).status).toBe(401);
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it('preserves protected-request errors while handling expired authentication', () => {
    let receivedError: unknown;
    const protectedUrl = `${environment.apiUrl}/api/rooms/my`;

    http.get(protectedUrl).subscribe({
      error: (error: unknown) => {
        receivedError = error;
      },
    });

    const request = httpTesting.expectOne(protectedUrl);
    request.flush(
      { message: 'Authentication required' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    expect(handleUnauthorized).toHaveBeenCalledWith(
      TestBed.inject(Router).url
    );
  });

  it('attaches the current bearer token to protected room requests', () => {
    const token = 'signed-test-token';
    getAccessToken.mockReturnValue(token);
    const roomUrl = `${environment.apiUrl}/api/rooms`;

    http.post(roomUrl, { roomName: 'Test room' }).subscribe();

    const request = httpTesting.expectOne(roomUrl);
    expect(request.request.headers.get('Authorization')).toBe(
      `Bearer ${token}`
    );
    request.flush({});
  });

  it('does not attach the bearer token to public login requests', () => {
    getAccessToken.mockReturnValue('signed-test-token');
    const loginUrl = `${environment.apiUrl}/api/auth/login`;

    http.post(loginUrl, {}).subscribe();

    const request = httpTesting.expectOne(loginUrl);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});