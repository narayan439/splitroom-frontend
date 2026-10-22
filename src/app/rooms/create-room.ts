import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { defer, finalize, TimeoutError } from 'rxjs';
import { RoomDetails } from './room.models';
import { RoomService } from './room.service';

@Component({
  selector: 'app-create-room',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-room.html',
  styleUrl: './create-room.scss',
})
export class CreateRoom implements OnInit {
  private readonly roomApi = inject(RoomService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly form = new FormGroup({
    roomName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
  });

  loading = false;
  submitted = false;
  errorMessage = '';
  currentRooms: RoomDetails[] = [];
  membershipLoading = true;
  membershipError = '';

  ngOnInit(): void {
    this.loadMembership();
  }

  loadMembership(): void {
    this.membershipLoading = true;
    this.membershipError = '';
    this.changeDetector.markForCheck();
    defer(() => this.roomApi.getMyRooms())
      .pipe(
        finalize(() => {
          this.membershipLoading = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: (rooms) => {
          this.currentRooms = rooms;
          this.membershipError = '';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.membershipError =
            error instanceof TimeoutError
              ? 'Checking your room timed out. Check your connection, then try again.'
              : 'We could not confirm your room membership. Check that the backend and database are available, then retry.';
          this.changeDetector.markForCheck();
        },
      });
  }

  submit(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (
      this.form.invalid ||
      this.loading ||
      this.membershipLoading ||
      this.membershipError ||
      this.currentRooms.length > 0
    ) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.changeDetector.markForCheck();
    defer(() => this.roomApi.createRoom(this.form.getRawValue()))
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: (room) => {
          this.changeDetector.markForCheck();
          void this.router.navigate(['/rooms', room.roomId]);
        },
        error: (error: unknown) => {
          const responseMessage =
            error instanceof HttpErrorResponse &&
            error.status === 409 &&
            typeof error.error?.message === 'string'
              ? error.error.message.includes('already belong')
                ? 'You already belong to a room and cannot create another.'
                : 'Room creation conflicts with existing data.'
              : null;
          this.errorMessage =
            responseMessage ??
            (error instanceof HttpErrorResponse && error.status === 400
              ? 'Enter a valid room name and try again.'
              : error instanceof HttpErrorResponse && error.status === 401
                ? 'Your sign-in has expired. Sign in again to create a room.'
                : error instanceof HttpErrorResponse && error.status === 403
                  ? 'You are not allowed to create a room.'
                  : error instanceof HttpErrorResponse && error.status >= 500
                    ? 'The room service or database is temporarily unavailable. Please try again.'
              : error instanceof TimeoutError
                ? 'Room creation timed out. Check your room list before trying again.'
                : 'The room could not be created. Please try again.');
          this.changeDetector.markForCheck();
        },
      });
  }
}
