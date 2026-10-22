import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AccountApiService } from '../auth/account-api.service';
import { AuthService } from '../auth/auth.service';
import { RoomDetails, RoomInvitation, RoomMember } from '../rooms/room.models';
import { RoomService } from '../rooms/room.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit {

  constructor(
    readonly auth: AuthService,
    private readonly roomService: RoomService,
    private readonly accountApi: AccountApiService,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.profileForm = new FormGroup({
      name: new FormControl(this.name, {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      email: new FormControl(this.email, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.email,
          Validators.maxLength(150),
        ],
      }),
      phone: new FormControl(this.auth.currentUser?.phone ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/^(?:\+[0-9]{7,14}|[0-9]{8,15})$/),
        ],
      }),
    });

    this.passwordForm = new FormGroup(
      {
        currentPassword: new FormControl('', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        newPassword: new FormControl('', {
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
  }

  rooms: RoomDetails[] = [];
  memberships: Record<number, RoomMember> = {};
  roomsLoading = true;
  roomsError = '';
  invitations: RoomInvitation[] = [];
  invitationsLoading = true;
  invitationsError = '';
  invitationMessage = '';
  invitationActionId: number | null = null;
  editingProfile = false;
  changingPassword = false;
  profileSubmitting = false;
  passwordSubmitting = false;
  profileError = '';
  profileMessage = '';
  passwordError = '';
  passwordMessage = '';

  readonly profileForm: FormGroup<{
    name: FormControl<string>;
    email: FormControl<string>;
    phone: FormControl<string>;
  }>;

  readonly passwordForm: FormGroup<{
    currentPassword: FormControl<string>;
    newPassword: FormControl<string>;
    confirmPassword: FormControl<string>;
  }>;

  ngOnInit(): void {
    this.loadRooms();
    this.loadInvitations();
  }

  get name(): string {
    return this.auth.currentUser?.name ?? '';
  }

  get email(): string {
    return this.auth.currentUser?.email ?? '';
  }

  get hasRoomMembership(): boolean {
    return this.rooms.length > 0;
  }

  loadRooms(): void {
    this.roomsLoading = true;
    this.roomsError = '';
    this.memberships = {};
    this.rooms = [];
    this.roomService.getMyRooms().subscribe({
      next: (rooms) => {
        this.rooms = rooms;
        if (rooms.length === 0) {
          this.roomsLoading = false;
          this.changeDetector.markForCheck();
          return;
        }
        forkJoin(
          rooms.map((room) =>
            this.roomService.getMembers(room.roomId)
          )
        ).subscribe({
          next: (memberGroups) => {
            this.memberships = {};
            rooms.forEach((room, index) => {
              const currentUserMembership = memberGroups[index].find(
                (member) => member.userId === this.auth.currentUser?.userId
              );
              if (currentUserMembership) {
                this.memberships[room.roomId] = currentUserMembership;
              }
            });
            this.roomsLoading = false;
            this.changeDetector.markForCheck();
          },
          error: () => {
            this.roomsError =
              'Your room loaded, but membership details could not be retrieved.';
            this.roomsLoading = false;
            this.changeDetector.markForCheck();
          },
        });
      },
      error: (error: unknown) => {
        this.roomsError =
          error instanceof HttpErrorResponse && error.status === 0
            ? 'Could not connect to the room service. Check that the backend is running.'
            : 'Your rooms could not be loaded. Please try again.';
        this.roomsLoading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  loadInvitations(): void {
    this.invitationsLoading = true;
    this.invitationsError = '';
    this.roomService.getMyInvitations().subscribe({
      next: (invitations) => {
        this.invitations = invitations.filter(
          (invitation) => invitation.status === 'PENDING'
        );
        this.invitationsLoading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.invitationsError =
          'Your invitations could not be loaded. Check your connection and try again.';
        this.invitationsLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  acceptInvitation(invitation: RoomInvitation): void {
    if (
      this.invitationActionId !== null ||
      this.roomsLoading ||
      this.roomsError ||
      this.hasRoomMembership
    ) {
      return;
    }
    this.invitationActionId = invitation.invitationId;
    this.invitationsError = '';
    this.invitationMessage = '';
    this.roomService.acceptInvitation(invitation.invitationId).subscribe({
      next: () => {
        this.invitations = this.invitations.filter(
          (item) => item.invitationId !== invitation.invitationId
        );
        this.invitationMessage = `You joined ${invitation.roomName}.`;
        this.invitationActionId = null;
        this.loadRooms();
        this.loadInvitations();
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.invitationsError =
          error instanceof HttpErrorResponse &&
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'That invitation could not be accepted. You may already belong to another room.';
        this.invitationActionId = null;
        this.loadRooms();
        this.changeDetector.markForCheck();
      },
    });
  }

  declineInvitation(invitation: RoomInvitation): void {
    if (this.invitationActionId !== null) {
      return;
    }
    this.invitationActionId = invitation.invitationId;
    this.invitationsError = '';
    this.invitationMessage = '';
    this.roomService.declineInvitation(invitation.invitationId).subscribe({
      next: () => {
        this.invitations = this.invitations.filter(
          (item) => item.invitationId !== invitation.invitationId
        );
        this.invitationMessage = 'Invitation declined.';
        this.invitationActionId = null;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.invitationsError = 'That invitation could not be declined.';
        this.invitationActionId = null;
        this.changeDetector.markForCheck();
      },
    });
  }

  toggleEditProfile(): void {
    this.editingProfile = !this.editingProfile;
    this.profileError = '';
    if (this.editingProfile) {
      this.profileForm.reset({
        name: this.name,
        email: this.email,
        phone: this.auth.currentUser?.phone ?? '',
      });
    }
  }

  saveProfile(): void {
    if (this.profileSubmitting) {
      return;
    }
    this.profileError = '';
    this.profileMessage = '';
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.profileSubmitting = true;
    this.accountApi
      .updateProfile(this.profileForm.getRawValue())
      .pipe(
        finalize(() => {
          this.profileSubmitting = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.auth.replaceSession(response);
          this.profileMessage = 'Your profile has been updated.';
          this.editingProfile = false;
        },
        error: (error: unknown) => {
          this.profileError = this.getAccountError(
            error,
            'Your profile could not be updated. Please try again.'
          );
        },
      });
  }

  toggleChangePassword(): void {
    this.changingPassword = !this.changingPassword;
    this.passwordError = '';
    this.passwordForm.reset();
  }

  savePassword(): void {
    if (this.passwordSubmitting) {
      return;
    }
    this.passwordError = '';
    this.passwordMessage = '';
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.passwordSubmitting = true;
    this.accountApi
      .changePassword({ currentPassword, newPassword })
      .pipe(
        finalize(() => {
          this.passwordSubmitting = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.passwordMessage = 'Your password has been changed.';
          this.changingPassword = false;
          this.passwordForm.reset();
        },
        error: (error: unknown) => {
          this.passwordError = this.getAccountError(
            error,
            'Your password could not be changed. Please try again.'
          );
        },
      });
  }

  private getAccountError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 0) {
      return 'Unable to connect. Check your connection and try again.';
    }
    if (error.status === 409) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'That email or phone number is already in use.';
    }
    if (error.status === 400) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'Check the information you entered and try again.';
    }
    if (error.status === 403) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'Your current password is incorrect.';
    }
    return fallback;
  }

}

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return !confirmPassword || newPassword === confirmPassword
    ? null
    : { passwordsMismatch: true };
}