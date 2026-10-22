import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Register } from './register';

describe('Register', () => {
  it('maps duplicate email responses to a safe field error', async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            register: () =>
              throwError(
                () =>
                  new HttpErrorResponse({
                    status: 409,
                    error: {
                      message: 'An account with this email already exists',
                    },
                  })
              ),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;
    component.form.setValue({
      name: 'Jordan',
      email: 'jordan@example.com',
      phone: '9876543210',
      password: 'password123',
      confirmPassword: 'password123',
    });
    component.submit();
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.fieldError('email'))
      .toBe('An account with this email already exists.');
    expect(component.errorMessage)
      .toBe('An account with this email already exists.');
  });

  it('maps backend validation errors without rendering raw server details', async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            register: () =>
              throwError(
                () =>
                  new HttpErrorResponse({
                    status: 400,
                    error: {
                      message:
                        'email: Email must be valid; password: Password must be 8 to 72 characters',
                    },
                  })
              ),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;
    component.form.setValue({
      name: 'Jordan',
      email: 'jordan@example.com',
      phone: '9876543210',
      password: 'password123',
      confirmPassword: 'password123',
    });
    component.submit();

    expect(component.fieldError('email')).toBe('Enter a valid email address.');
    expect(component.fieldError('password'))
      .toBe('Password must be between 8 and 72 characters.');
    expect(component.errorMessage).toBe('Please correct the highlighted fields.');
    expect(component.errorMessage).not.toContain('SQL');
  });

  it('updates the view after async registration failure and permits retry', async () => {
    const requests: Subject<never>[] = [];
    const auth = {
      register: vi.fn(() => {
        const request = new Subject<never>();
        requests.push(request);
        return request;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;
    component.form.setValue({
      name: 'Jordan',
      email: 'jordan@example.com',
      phone: '9876543210',
      password: 'password123',
      confirmPassword: 'password123',
    });

    component.submit();
    expect(component.loading).toBe(true);
    requests[0].error(
      new HttpErrorResponse({
        status: 409,
        error: { message: 'An account with this email already exists' },
      })
    );
    await fixture.whenStable();

    expect(component.loading).toBe(false);
    expect(component.errorMessage)
      .toBe('An account with this email already exists.');
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('An account with this email already exists.');

    component.form.controls.email.setValue('new@example.com');
    component.submit();
    expect(component.loading).toBe(true);
    expect(auth.register).toHaveBeenCalledTimes(2);
  });
});
