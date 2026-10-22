import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';

describe('AuthService login', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('does not store a token or authenticate after a failed login', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthApiService,
          useValue: {
            login: () =>
              throwError(
                () =>
                  new HttpErrorResponse({
                    status: 401,
                    error: { message: 'Invalid email or password' },
                  })
              ),
          },
        },
      ],
    });

    const auth = TestBed.inject(AuthService);
    let receivedStatus: number | undefined;
    auth.login({
      email: 'person@example.com',
      password: 'incorrect-password',
    }).subscribe({
      error: (error: HttpErrorResponse) => {
        receivedStatus = error.status;
      },
    });

    expect(receivedStatus).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser).toBeNull();
    expect(sessionStorage.getItem('splitroom.auth.session')).toBeNull();
  });
});