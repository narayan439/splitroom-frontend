import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { AuthResponse } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  it('shows the backend credential error and clears loading immediately', async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: AuthService,
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
    }).compileComponents();

    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;
    component.form.setValue({
      email: 'missing@example.com',
      password: 'incorrect-password',
    });
    component.submit();
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Invalid email or password.');
    expect((fixture.nativeElement as HTMLElement).textContent)
      .not.toContain('missing@example.com is not registered');
  });

  it('reports unavailable backend without exposing account existence', async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: AuthService,
          useValue: {
            login: () =>
              throwError(
                () => new HttpErrorResponse({ status: 0, statusText: 'Offline' })
              ),
          },
        },
      ],
    }).compileComponents();

    const component = TestBed.createComponent(Login).componentInstance;
    component.form.setValue({
      email: 'unknown@example.com',
      password: 'password123',
    });
    component.submit();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toContain('Unable to reach');
    expect(component.errorMessage).not.toContain('unknown@example.com');
  });

  it('renders an asynchronous 401 and permits a successful retry', async () => {
    const requests: Subject<AuthResponse>[] = [];
    const auth = {
      login: vi.fn(() => {
        const request = new Subject<AuthResponse>();
        requests.push(request);
        return request;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;
    const navigateByUrl = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    component.form.setValue({
      email: 'person@example.com',
      password: 'wrong-password',
    });

    component.submit();
    expect(component.loading).toBe(true);
    requests[0].error(
      new HttpErrorResponse({
        status: 401,
        error: { message: 'Invalid email or password' },
      })
    );
    await fixture.whenStable();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Invalid email or password.');
    expect(fixture.nativeElement.textContent).toContain(
      'Invalid email or password.'
    );
    expect(component.form.controls.email.value).toBe('person@example.com');
    expect(component.form.controls.password.value).toBe('wrong-password');

    component.form.controls.password.setValue('correct-password');
    component.submit();
    expect(component.loading).toBe(true);
    requests[1].next({
      tokenType: 'Bearer',
      accessToken: 'test-token',
      expiresInSeconds: 3600,
      user: {
        userId: 1,
        name: 'Person',
        email: 'person@example.com',
        phone: null,
      },
    });
    requests[1].complete();
    await fixture.whenStable();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('');
    expect(auth.login).toHaveBeenCalledTimes(2);
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('catches synchronous service failures and clears loading', async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: AuthService,
          useValue: {
            login: () => {
              throw new Error('Synchronous request setup failure');
            },
          },
        },
      ],
    }).compileComponents();

    const component = TestBed.createComponent(Login).componentInstance;
    component.form.setValue({
      email: 'person@example.com',
      password: 'password123',
    });

    expect(() => component.submit()).not.toThrow();
    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe(
      'We could not sign you in right now. Please try again.'
    );
  });
});
