import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { defer, finalize, TimeoutError } from 'rxjs';

type RegistrationField = 'name' | 'email' | 'phone' | 'password';
import { AuthService } from '../auth/auth.service';

const passwordsMatch: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmation = control.get('confirmPassword')?.value;
  return password === confirmation ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.email,
          Validators.maxLength(150),
        ],
      }),
      phone: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/^(?:\+[0-9]{7,14}|[0-9]{8,15})$/),
        ],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
        ],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatch }
  );

  loading = false;
  submitted = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;
  serverFieldErrors: Partial<Record<RegistrationField, string>> = {};

  submit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.serverFieldErrors = {};
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, phone, password } = this.form.getRawValue();
    this.loading = true;
    defer(() => this.auth.register({ name, email, phone, password }))
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/login'], {
            queryParams: { registered: 'true' },
          });
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.applyDuplicateError(error);
          } else if (error instanceof HttpErrorResponse && error.status === 400) {
            this.applyValidationErrors(error);
          } else if (error instanceof HttpErrorResponse && error.status === 0) {
            this.errorMessage = 'Unable to reach the registration service. Check your connection and try again.';
          } else if (error instanceof TimeoutError) {
            this.errorMessage = 'The registration service did not respond in time. Please try again.';
          } else if (error instanceof HttpErrorResponse && error.status === 403) {
            this.errorMessage = 'Registration is currently unavailable for this request.';
          } else if (
            error instanceof HttpErrorResponse &&
            (error.status === 401 || error.status === 404 || error.status >= 500)
          ) {
            this.errorMessage = 'We could not create your account right now. Please try again.';
          } else {
            this.errorMessage =
              'We could not create your account right now. Please try again.';
          }
          this.changeDetector.markForCheck();
        },
      });
  }

  private applyDuplicateError(error: HttpErrorResponse): void {
    const message = this.getBackendMessage(error)?.toLowerCase() ?? '';
    if (message.includes('email')) {
      this.serverFieldErrors.email = 'An account with this email already exists.';
      this.errorMessage = this.serverFieldErrors.email;
    } else if (message.includes('phone')) {
      this.serverFieldErrors.phone = 'An account with this phone already exists.';
      this.errorMessage = this.serverFieldErrors.phone;
    } else {
      this.errorMessage = 'An account with this email or phone already exists.';
    }
  }

  private applyValidationErrors(error: HttpErrorResponse): void {
    const message = this.getBackendMessage(error) ?? '';
    const entries = message.split(';').map((entry) => entry.trim());
    for (const entry of entries) {
      const separator = entry.indexOf(':');
      if (separator < 0) {
        continue;
      }
      const field = entry.slice(0, separator).trim() as RegistrationField;
      if (!['name', 'email', 'phone', 'password'].includes(field)) {
        continue;
      }
      this.serverFieldErrors[field] = this.validationMessage(field, entry.slice(separator + 1));
    }
    this.errorMessage = Object.keys(this.serverFieldErrors).length === 0
      ? 'Check the highlighted fields and try again.'
      : 'Please correct the highlighted fields.';
  }

  private validationMessage(field: RegistrationField, detail: string): string {
    const normalized = detail.toLowerCase();
    if (field === 'email') {
      return normalized.includes('required')
        ? 'Email is required.'
        : 'Enter a valid email address.';
    }
    if (field === 'phone') {
      return normalized.includes('required')
        ? 'Phone number is required.'
        : 'Enter 8–15 digits, optionally starting with +.';
    }
    if (field === 'password') {
      return normalized.includes('required')
        ? 'Password is required.'
        : 'Password must be between 8 and 72 characters.';
    }
    return normalized.includes('required')
      ? 'Name is required.'
      : 'Name must be 100 characters or fewer.';
  }

  private getBackendMessage(error: HttpErrorResponse): string | null {
    const message = error.error?.message;
    return typeof message === 'string' ? message : null;
  }

  fieldError(controlName: RegistrationField): string | null {
    return this.serverFieldErrors[controlName] ?? null;
  }

  showError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return control !== null && control.invalid &&
      (control.touched || this.submitted);
  }

  get passwordMismatch(): boolean {
    return this.form.hasError('passwordMismatch') &&
      (this.form.controls.confirmPassword.touched || this.submitted);
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
      return;
    }
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
