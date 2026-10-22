import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { defer, finalize, TimeoutError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { isSafeInternalUrl } from '../auth/auth.guards';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  loading = false;
  errorMessage = '';
  submitted = false;
  showPassword = false;
  readonly registrationComplete =
    this.route.snapshot.queryParamMap.get('registered') === 'true';

  submit(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    defer(() => this.auth.login(this.form.getRawValue()))
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          void this.router.navigateByUrl(
            isSafeInternalUrl(returnUrl) ? returnUrl : '/dashboard'
          );
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.errorMessage = 'Invalid email or password.';
          } else if (error instanceof HttpErrorResponse && error.status === 400) {
            this.errorMessage = 'Enter a valid email address and password.';
          } else if (
            error instanceof HttpErrorResponse &&
            error.status === 0
          ) {
            this.errorMessage =
              'Unable to reach the sign-in service. Check your connection and try again.';
          } else if (error instanceof TimeoutError) {
            this.errorMessage =
              'The sign-in service did not respond in time. Please try again.';
          } else if (error instanceof HttpErrorResponse && error.status === 403) {
            this.errorMessage = 'Sign-in is currently unavailable for this request.';
          } else if (
            error instanceof HttpErrorResponse &&
            (error.status === 404 || error.status === 409)
          ) {
            this.errorMessage = 'We could not sign you in right now. Please try again.';
          } else if (error instanceof HttpErrorResponse && error.status >= 500) {
            this.errorMessage =
              'The sign-in service is temporarily unavailable. Please try again.';
          } else {
            this.errorMessage =
              'We could not sign you in right now. Please try again.';
          }
          this.changeDetector.markForCheck();
        },
      });
  }

  showError(controlName: 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}
