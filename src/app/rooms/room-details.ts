import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  CreateSettlementRequest,
  AbsenceRuleType,
  ExpenseCategory,
  MemberBalance,
  MarkAbsentRequest,
  MarkReturnedRequest,
  RoomDetails as RoomDetailsModel,
  RoomExpense,
  RentCycleSummary,
  RoomInvitation,
  RoomMember,
  RoommateAbsence,
  RoomSettlement,
  SettlementStatus,
  SettlementSuggestion,
  SettlementSuggestions,
  UpdateAbsenceRulesRequest,
} from './room.models';
import { RoomService } from './room.service';

type AbsenceRuleFormGroup = FormGroup<{
  categoryId: FormControl<number>;
  ruleType: FormControl<AbsenceRuleType | null>;
}>;

@Component({
  selector: 'app-room-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './room-details.html',
  styleUrl: './room-details.scss',
})
export class RoomDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roomsApi = inject(RoomService);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private routeRoomId: number | null = null;

  room: RoomDetailsModel | null = null;
  members: RoomMember[] = [];
  absenceCategories: ExpenseCategory[] = [];
  absenceHistory: Record<number, RoommateAbsence[]> = {};
  absenceHistoryLoading: Record<number, boolean> = {};
  absenceHistoryErrors: Record<number, string> = {};
  absenceCategoriesLoading = false;
  absenceCategoriesError = '';
  absenceDialog: {
    type: 'mark' | 'return';
    member: RoomMember;
    absence: RoommateAbsence | null;
  } | null = null;
  absenceSubmitting = false;
  absenceActionMemberId: number | null = null;
  absenceError = '';
  absenceMessage = '';
  selectedRuleTarget: {
    member: RoomMember;
    absence: RoommateAbsence;
  } | null = null;
  rulesSubmitting = false;
  rulesError = '';
  rulesMessage = '';
  readonly markAbsentForm = new FormGroup({
    departureDate: new FormControl('', Validators.required),
    reason: new FormControl('', Validators.maxLength(255)),
  });
  readonly markReturnedForm = new FormGroup({
    returnDate: new FormControl('', Validators.required),
  });
  readonly absenceRulesForm = new FormGroup({
    rules: new FormArray<AbsenceRuleFormGroup>([]),
  });
  expenses: RoomExpense[] = [];
  rentCycles: RentCycleSummary[] = [];
  selectedRentCycleStart = '';
  rentCyclesLoading = false;
  rentCyclesError = '';
  invitations: RoomInvitation[] = [];
  balances: MemberBalance[] = [];
  settlementSuggestions: SettlementSuggestions | null = null;
  settlements: RoomSettlement[] = [];
  invitationStatusFilter: 'PENDING' | null = 'PENDING';
  settlementStatusFilter: SettlementStatus | null = null;
  currentRole: 'ADMIN' | 'MEMBER' | null = null;
  currentRoomMemberId: number | null = null;
  loading = true;
  membersLoading = false;
  membersError = '';
  expensesLoading = false;
  expensesError = '';
  expenseMessage = '';
  balancesLoading = false;
  settlementsLoading = false;
  settlementSubmitting = false;
  settlementActionId: number | null = null;
  invitationsLoading = false;
  inviting = false;
  showInvitationForm = false;
  cancellingInvitationId: number | null = null;
  pendingCancelInvitationId: number | null = null;
  selectedSuggestion: SettlementSuggestion | null = null;
  pendingSettlementAction: {
    settlement: RoomSettlement;
    action: 'complete' | 'cancel';
  } | null = null;
  errorMessage = '';
  balancesError = '';
  settlementsError = '';
  settlementMessage = '';
  invitationError = '';
  invitationMessage = '';
  memberActionError = '';
  memberActionMessage = '';
  memberActionUserId: number | null = null;
  pendingRemoveUserId: number | null = null;
  pendingAdminTransferUserId: number | null = null;
  readonly invitationForm = new FormGroup({
    invitedUserEmail: new FormControl('', [
      Validators.required,
      Validators.email,
    ]),
  });
  readonly settlementForm = new FormGroup({
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(9999999999.99),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/),
    ]),
    settlementDate: new FormControl(this.todayAsDateString(), [
      Validators.required,
    ]),
  });

  get isAdmin(): boolean {
    return this.currentRole === 'ADMIN';
  }

  get currentUserId(): number | null {
    return this.auth.currentUser?.userId ?? null;
  }

  get absenceRuleControls(): AbsenceRuleFormGroup[] {
    return this.absenceRulesForm.controls.rules.controls;
  }

  get selectedRentCycle(): RentCycleSummary | null {
    return this.rentCycles.find(
      (cycle) => cycle.startDate === this.selectedRentCycleStart
    ) ?? this.rentCycles[0] ?? null;
  }

  ngOnInit(): void {
    this.expenseMessage =
      this.router.getCurrentNavigation()?.extras.state?.['expenseCreated'] ===
      true
        ? 'Expense added successfully.'
        : '';
    const roomId = Number(this.route.snapshot.paramMap.get('roomId'));
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      this.loading = false;
      this.errorMessage = 'This room could not be found.';
      return;
    }
    this.routeRoomId = roomId;
    this.load(roomId);
  }

  refresh(): void {
    const roomId = this.room?.roomId ?? this.routeRoomId;
    if (roomId !== null) {
      this.load(roomId);
    }
  }

  sendInvitation(): void {
    this.invitationError = '';
    this.invitationMessage = '';
    if (
      this.invitationForm.invalid ||
      this.inviting ||
      !this.room ||
      !this.isAdmin
    ) {
      this.invitationForm.markAllAsTouched();
      return;
    }

    const invitedUserEmail =
      this.invitationForm.controls.invitedUserEmail.value?.trim();
    if (!invitedUserEmail) {
      return;
    }

    this.inviting = true;
    this.roomsApi
      .createInvitation(this.room.roomId, {
        invitedUserEmail: invitedUserEmail.toLowerCase(),
      })
      .subscribe({
        next: (invitation) => {
          this.invitationForm.reset();
          this.showInvitationForm = false;
          this.invitationMessage = `Invitation sent to ${invitation.invitedUserEmail}.`;
          this.refreshInvitations();
          this.inviting = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.invitationError =
            error instanceof HttpErrorResponse && error.status === 409
              ? 'This user is already a room member or has a pending invitation.'
              : this.getBackendMessage(error) ??
                'The invitation could not be sent. Check the email address and try again.';
          this.inviting = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  get currentBalance(): MemberBalance | null {
    return (
      this.balances.find(
        (balance) => balance.memberId === this.currentRoomMemberId
      ) ?? null
    );
  }

  openSettlementForm(suggestion: SettlementSuggestion): void {
    if (
      !this.room ||
      suggestion.fromMemberId !== this.currentRoomMemberId ||
      this.settlementSubmitting
    ) {
      return;
    }
    this.selectedSuggestion = suggestion;
    this.settlementForm.reset({
      amount: suggestion.amount,
      settlementDate: this.todayAsDateString(),
    });
    this.settlementForm.controls.amount.setValidators([
      Validators.required,
      Validators.min(0.01),
      Validators.max(suggestion.amount),
      Validators.max(9999999999.99),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/),
    ]);
    this.settlementForm.controls.amount.updateValueAndValidity();
    this.settlementMessage = '';
    this.settlementsError = '';
  }

  closeSettlementForm(): void {
    if (!this.settlementSubmitting) {
      this.selectedSuggestion = null;
      this.settlementForm.reset({
        amount: null,
        settlementDate: this.todayAsDateString(),
      });
    }
  }

  submitSettlement(): void {
    const suggestion = this.selectedSuggestion;
    const amount = this.settlementForm.controls.amount.value;
    const settlementDate =
      this.settlementForm.controls.settlementDate.value;
    if (
      !this.room ||
      !suggestion ||
      this.currentRoomMemberId !== suggestion.fromMemberId ||
      this.settlementForm.invalid ||
      amount === null ||
      !settlementDate ||
      this.settlementSubmitting
    ) {
      this.settlementForm.markAllAsTouched();
      return;
    }

    const request: CreateSettlementRequest = {
      fromMemberId: suggestion.fromMemberId,
      toMemberId: suggestion.toMemberId,
      amount,
      settlementDate,
    };
    this.settlementSubmitting = true;
    this.settlementsError = '';
    this.settlementMessage = '';
    this.roomsApi.createSettlement(this.room.roomId, request).subscribe({
      next: (settlement) => {
        this.settlementSubmitting = false;
        this.selectedSuggestion = null;
        this.settlementForm.reset({
          amount: null,
          settlementDate: this.todayAsDateString(),
        });
        this.settlementMessage =
          `Payment of ${this.formatInr(settlement.amount)} was recorded as pending.`;
        this.refreshFinancials();
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.settlementSubmitting = false;
        this.settlementsError =
          this.getBackendMessage(error) ??
          'The payment could not be recorded. Refresh balances and try again.';
        this.changeDetector.markForCheck();
      },
    });
  }

  requestSettlementAction(
    settlement: RoomSettlement,
    action: 'complete' | 'cancel'
  ): void {
    if (
      settlement.status !== 'PENDING' ||
      (action === 'cancel' && !this.isAdmin) ||
      (action === 'complete' && !this.canCompleteSettlement(settlement))
    ) {
      return;
    }
    this.pendingSettlementAction = { settlement, action };
  }

  dismissSettlementAction(): void {
    this.pendingSettlementAction = null;
  }

  confirmSettlementAction(): void {
    const action = this.pendingSettlementAction;
    if (!action || !this.room || this.settlementActionId !== null) {
      return;
    }
    const { settlement } = action;
    this.settlementActionId = settlement.settlementId;
    this.settlementsError = '';
    this.settlementMessage = '';
    const request =
      action.action === 'complete'
        ? this.roomsApi.completeSettlement(
            this.room.roomId,
            settlement.settlementId
          )
        : this.roomsApi.cancelSettlement(
            this.room.roomId,
            settlement.settlementId
          );
    request.subscribe({
      next: (updatedSettlement) => {
        this.settlementActionId = null;
        this.pendingSettlementAction = null;
        this.settlementMessage =
          action.action === 'complete'
            ? `Payment of ${this.formatInr(updatedSettlement.amount)} marked completed.`
            : 'Pending settlement cancelled.';
        this.refreshFinancials();
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.settlementActionId = null;
        this.settlementsError =
          this.getBackendMessage(error) ??
          `The settlement could not be ${action.action === 'complete' ? 'completed' : 'cancelled'}.`;
        this.changeDetector.markForCheck();
      },
    });
  }

  canCompleteSettlement(settlement: RoomSettlement): boolean {
    return (
      this.isAdmin ||
      settlement.fromMember.memberId === this.currentRoomMemberId ||
      settlement.toMember.memberId === this.currentRoomMemberId
    );
  }

  setSettlementStatusFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.settlementStatusFilter =
      value === 'PENDING' || value === 'COMPLETED' || value === 'CANCELLED'
        ? value
        : null;
    if (this.room) {
      this.refreshFinancials();
    }
  }

  memberBalanceLabel(balance: MemberBalance): string {
    if (balance.netBalance < 0) {
      return `Owes ${this.formatInr(Math.abs(balance.netBalance))}`;
    }
    if (balance.netBalance > 0) {
      return `Is owed ${this.formatInr(balance.netBalance)}`;
    }
    return 'Settled up';
  }

  formatInr(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  toggleInvitationHistory(): void {
    this.invitationStatusFilter =
      this.invitationStatusFilter === 'PENDING' ? null : 'PENDING';
    this.refreshInvitations();
  }

  requestCancelInvitation(invitation: RoomInvitation): void {
    this.pendingCancelInvitationId = invitation.invitationId;
  }

  dismissCancelInvitation(): void {
    this.pendingCancelInvitationId = null;
  }

  cancelInvitation(invitation: RoomInvitation): void {
    if (!this.isAdmin || invitation.status !== 'PENDING') {
      return;
    }
    this.invitationError = '';
    this.invitationMessage = '';
    this.cancellingInvitationId = invitation.invitationId;
    this.roomsApi.cancelInvitation(invitation.invitationId).subscribe({
      next: () => {
        this.invitationMessage = 'Invitation cancelled.';
        this.pendingCancelInvitationId = null;
        this.cancellingInvitationId = null;
        this.refreshInvitations();
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.invitationError =
          this.getBackendMessage(error) ??
          'The invitation could not be cancelled.';
        this.cancellingInvitationId = null;
        this.changeDetector.markForCheck();
      },
    });
  }

  beginRemoveMember(member: RoomMember): void {
    this.pendingRemoveUserId = member.userId;
    this.pendingAdminTransferUserId = null;
    this.memberActionError = '';
    this.memberActionMessage = '';
  }

  cancelRemoveMember(): void {
    this.pendingRemoveUserId = null;
  }

  removeMember(member: RoomMember): void {
    if (!this.room || !this.isAdmin || this.memberActionUserId !== null) {
      return;
    }
    const roomId = this.room.roomId;
    this.memberActionUserId = member.userId;
    this.memberActionError = '';
    this.memberActionMessage = '';
    this.roomsApi.removeMember(this.room.roomId, member.userId).subscribe({
      next: (response) => {
        this.memberActionMessage = response.message;
        this.pendingRemoveUserId = null;
        this.memberActionUserId = null;
        this.load(roomId);
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.memberActionError =
          error instanceof HttpErrorResponse && error.status === 409
            ? this.getBackendMessage(error) ??
              'This member cannot be removed from the room.'
            : 'The member could not be removed. Check your room admin access and try again.';
        this.memberActionUserId = null;
        this.changeDetector.markForCheck();
      },
    });
  }

  beginAdminTransfer(member: RoomMember): void {
    this.pendingAdminTransferUserId = member.userId;
    this.pendingRemoveUserId = null;
    this.memberActionError = '';
    this.memberActionMessage = '';
  }

  cancelAdminTransfer(): void {
    this.pendingAdminTransferUserId = null;
  }

  transferAdmin(member: RoomMember): void {
    if (!this.room || !this.isAdmin || this.memberActionUserId !== null) {
      return;
    }
    const roomId = this.room.roomId;
    this.memberActionUserId = member.userId;
    this.memberActionError = '';
    this.memberActionMessage = '';
    this.roomsApi.transferAdmin(this.room.roomId, member.userId).subscribe({
      next: (response) => {
        this.memberActionMessage = response.message;
        this.pendingAdminTransferUserId = null;
        this.memberActionUserId = null;
        this.load(roomId);
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.memberActionError =
          error instanceof HttpErrorResponse && error.status === 409
            ? this.getBackendMessage(error) ??
              'The room admin role could not be transferred.'
            : 'The room admin role could not be transferred. Check your room admin access and try again.';
        this.memberActionUserId = null;
        this.changeDetector.markForCheck();
      },
    });
  }

  refreshAbsenceHistory(memberId: number): void {
    if (!this.room) {
      return;
    }
    this.absenceHistoryLoading[memberId] = true;
    delete this.absenceHistoryErrors[memberId];
    this.roomsApi
      .getAbsenceHistory(this.room.roomId, memberId)
      .pipe(timeout({ first: 15000 }))
      .subscribe({
        next: (history) => {
          this.absenceHistory[memberId] = history;
          this.absenceHistoryLoading[memberId] = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.absenceHistoryErrors[memberId] =
            this.getBackendMessage(error) ??
            'Absence history could not be loaded.';
          this.absenceHistoryLoading[memberId] = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  hasActiveAbsence(memberId: number): boolean {
    return (this.absenceHistory[memberId] ?? []).some(
      (absence) => absence.status === 'ACTIVE'
    );
  }

  toggleMemberAbsence(member: RoomMember): void {
    if (!this.isAdmin || !this.room || this.absenceSubmitting) {
      return;
    }

    const activeAbsence = (this.absenceHistory[member.roomMemberId] ?? []).find(
      (absence) => absence.status === 'ACTIVE'
    );
    this.absenceSubmitting = true;
    this.absenceActionMemberId = member.roomMemberId;
    this.absenceError = '';
    this.absenceMessage = '';

    const request = activeAbsence
      ? this.roomsApi.markReturned(
          this.room.roomId,
          member.roomMemberId,
          activeAbsence.absenceId,
          {
            returnDate:
              this.todayAsDateString() < activeAbsence.departureDate
                ? activeAbsence.departureDate
                : this.todayAsDateString(),
          }
        )
      : this.roomsApi.markAbsent(this.room.roomId, member.roomMemberId, {
          departureDate: this.todayAsDateString(),
          reason: null,
        });

    request.subscribe({
      next: (absence) => {
        this.absenceSubmitting = false;
        this.absenceActionMemberId = null;
        this.absenceHistory[member.roomMemberId] = [
          absence,
          ...(this.absenceHistory[member.roomMemberId] ?? []).filter(
            (existing) => existing.absenceId !== absence.absenceId
          ),
        ];
        this.absenceMessage = activeAbsence
          ? `${member.name} was marked present. Previous expense shares were not changed.`
          : `${member.name} was marked absent. Previous expense shares were not changed.`;
        this.refreshAbsenceHistory(member.roomMemberId);
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.absenceSubmitting = false;
        this.absenceActionMemberId = null;
        this.absenceError =
          this.getBackendMessage(error) ??
          `The member could not be marked ${activeAbsence ? 'present' : 'absent'}. Check your admin access and retry.`;
        this.changeDetector.markForCheck();
      },
    });
  }

  openMarkAbsent(member: RoomMember): void {
    if (
      !this.isAdmin ||
      this.absenceHistoryLoading[member.roomMemberId] ||
      this.absenceHistoryErrors[member.roomMemberId] ||
      this.hasActiveAbsence(member.roomMemberId) ||
      this.absenceSubmitting
    ) {
      return;
    }
    this.absenceDialog = { type: 'mark', member, absence: null };
    this.markAbsentForm.reset({ departureDate: '', reason: '' });
    this.absenceError = '';
  }

  openMarkReturned(member: RoomMember, absence: RoommateAbsence): void {
    if (
      !this.isAdmin ||
      absence.status !== 'ACTIVE' ||
      absence.returnDate !== null ||
      this.absenceSubmitting
    ) {
      return;
    }
    this.absenceDialog = { type: 'return', member, absence };
    this.markReturnedForm.reset({ returnDate: '' });
    this.markReturnedForm.controls.returnDate.setValidators([
      Validators.required,
      (control) => {
        const returnDate = control.value as string;
        return returnDate &&
          returnDate < absence.departureDate
          ? { beforeDeparture: true }
          : null;
      },
    ]);
    this.markReturnedForm.controls.returnDate.updateValueAndValidity();
    this.absenceError = '';
  }

  closeAbsenceDialog(): void {
    if (this.absenceSubmitting) {
      return;
    }
    this.absenceDialog = null;
    this.absenceError = '';
  }

  confirmAbsenceDialog(): void {
    const dialog = this.absenceDialog;
    if (!this.isAdmin || !dialog || !this.room || this.absenceSubmitting) {
      return;
    }

    if (dialog.type === 'mark') {
      if (
        this.markAbsentForm.invalid ||
        this.hasActiveAbsence(dialog.member.roomMemberId)
      ) {
        this.markAbsentForm.markAllAsTouched();
        if (this.hasActiveAbsence(dialog.member.roomMemberId)) {
          this.absenceError =
            'This member already has an active absence period.';
        }
        return;
      }
      const request: MarkAbsentRequest = {
        departureDate:
          this.markAbsentForm.controls.departureDate.value ?? '',
        reason:
          this.markAbsentForm.controls.reason.value?.trim() || null,
      };
      this.absenceSubmitting = true;
      this.absenceError = '';
      this.roomsApi
        .markAbsent(this.room.roomId, dialog.member.roomMemberId, request)
        .subscribe({
          next: (absence) => {
            this.absenceSubmitting = false;
            this.absenceDialog = null;
            this.absenceHistory[dialog.member.roomMemberId] = [
              absence,
              ...(this.absenceHistory[dialog.member.roomMemberId] ?? []),
            ];
            this.absenceMessage = `${dialog.member.name} was marked absent. Previous expenses and shares were not changed.`;
            this.refreshAbsenceHistory(dialog.member.roomMemberId);
            this.changeDetector.markForCheck();
          },
          error: (error: unknown) => {
            this.absenceSubmitting = false;
            this.absenceError =
              this.getBackendMessage(error) ??
              'The member could not be marked absent. Check admin access and try again.';
            this.changeDetector.markForCheck();
          },
        });
      return;
    }

    const absence = dialog.absence;
    const returnDate = this.markReturnedForm.controls.returnDate.value;
    if (
      !absence ||
      absence.status !== 'ACTIVE' ||
      this.markReturnedForm.invalid ||
      !returnDate
    ) {
      this.markReturnedForm.markAllAsTouched();
      return;
    }
    const request: MarkReturnedRequest = { returnDate };
    this.absenceSubmitting = true;
    this.absenceError = '';
    this.roomsApi
      .markReturned(
        this.room.roomId,
        dialog.member.roomMemberId,
        absence.absenceId,
        request
      )
      .subscribe({
        next: (updatedAbsence) => {
          this.absenceSubmitting = false;
          this.absenceDialog = null;
          this.absenceHistory[dialog.member.roomMemberId] = (
            this.absenceHistory[dialog.member.roomMemberId] ?? []
          ).map((absence) =>
            absence.absenceId === updatedAbsence.absenceId
              ? updatedAbsence
              : absence
          );
          this.absenceMessage = `${dialog.member.name} was marked returned. Historical expense shares were not changed.`;
          this.refreshAbsenceHistory(dialog.member.roomMemberId);
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.absenceSubmitting = false;
          this.absenceError =
            this.getBackendMessage(error) ??
            'The return could not be recorded. Check the dates and admin access, then try again.';
          this.changeDetector.markForCheck();
        },
      });
  }

  openAbsenceRules(member: RoomMember, absence: RoommateAbsence): void {
    if (!this.isAdmin || this.rulesSubmitting) {
      return;
    }
    this.selectedRuleTarget = { member, absence };
    this.rulesError = '';
    this.rulesMessage = '';
    const rulesByCategory = new Map(
      absence.rules.map((rule) => [rule.categoryId, rule.ruleType])
    );
    const ruleControls = this.absenceCategories.map((category) =>
      new FormGroup({
        categoryId: new FormControl(category.categoryId, {
          nonNullable: true,
        }),
        ruleType: new FormControl<AbsenceRuleType | null>(
          rulesByCategory.get(category.categoryId) ?? null
        ),
      })
    );
    this.absenceRulesForm.setControl(
      'rules',
      new FormArray<AbsenceRuleFormGroup>(ruleControls)
    );
  }

  closeAbsenceRules(): void {
    if (!this.rulesSubmitting) {
      this.selectedRuleTarget = null;
      this.rulesError = '';
    }
  }

  saveAbsenceRules(): void {
    const target = this.selectedRuleTarget;
    if (!this.isAdmin || !this.room || !target || this.rulesSubmitting) {
      return;
    }
    const rules: UpdateAbsenceRulesRequest['rules'] = [];
    for (const control of this.absenceRuleControls) {
      const { categoryId, ruleType } = control.getRawValue();
      if (ruleType !== null) {
        if (!this.absenceCategories.some((category) => category.categoryId === categoryId)) {
          this.rulesError = 'A selected category does not belong to this room.';
          return;
        }
        rules.push({ categoryId, ruleType });
      }
    }

    this.rulesSubmitting = true;
    this.rulesError = '';
    this.roomsApi
      .updateAbsenceRules(
        this.room.roomId,
        target.member.roomMemberId,
        target.absence.absenceId,
        { rules }
      )
      .subscribe({
        next: (updatedAbsence) => {
          const current = this.absenceHistory[target.member.roomMemberId] ?? [];
          this.absenceHistory[target.member.roomMemberId] = current.map(
            (absence) =>
              absence.absenceId === updatedAbsence.absenceId
                ? updatedAbsence
                : absence
          );
          this.selectedRuleTarget = {
            member: target.member,
            absence: updatedAbsence,
          };
          this.rulesSubmitting = false;
          this.rulesMessage = 'Absence category rules saved.';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.rulesSubmitting = false;
          this.rulesError =
            this.getBackendMessage(error) ??
            'Absence category rules could not be saved.';
          this.changeDetector.markForCheck();
        },
      });
  }

  absenceRuleLabel(ruleType: AbsenceRuleType): string {
    switch (ruleType) {
      case 'FULL':
        return 'FULL — excluded for the entire absence';
      case 'DAILY':
        return 'DAILY — backend daily calculation';
      case 'EXCLUDED':
        return 'EXCLUDED — no absence-based exclusion';
    }
  }

  absenceCategoryName(categoryId: number): string {
    return (
      this.absenceCategories.find(
        (category) => category.categoryId === categoryId
      )?.categoryName ?? 'Unknown category'
    );
  }

  private load(roomId: number): void {
    this.loading = true;
    this.errorMessage = '';
    this.membersLoading = true;
    this.membersError = '';
    this.roomsApi
      .getRoom(roomId)
      .pipe(timeout({ first: 15000 }))
      .subscribe({
      next: (room) => {
        this.room = room;
        this.loading = false;
        this.changeDetector.markForCheck();
        this.refreshExpenses();
        this.loadMembers(roomId);
      },
      error: (error: unknown) => {
        this.errorMessage =
          error instanceof HttpErrorResponse && error.status === 404
            ? 'This room does not exist or is no longer available.'
            : 'Room details could not be loaded. Check your connection and room access, then try again.';
        this.loading = false;
        this.membersLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  refreshExpenses(): void {
    if (!this.room) {
      return;
    }
    this.expensesLoading = true;
    this.expensesError = '';
    this.roomsApi
      .getRoomExpenses(this.room.roomId)
      .pipe(timeout({ first: 15000 }))
      .subscribe({
        next: (expenses) => {
          this.expenses = expenses;
          this.expensesLoading = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.expensesError =
            this.getBackendMessage(error) ??
            'Room expenses could not be loaded. Try refreshing.';
          this.expensesLoading = false;
          this.changeDetector.markForCheck();
        },
      });
    this.refreshRentCycles();
  }

  refreshRentCycles(): void {
    if (!this.room) {
      return;
    }
    this.rentCyclesLoading = true;
    this.rentCyclesError = '';
    this.roomsApi
      .getRoomRentCycles(this.room.roomId)
      .pipe(timeout({ first: 15000 }))
      .subscribe({
        next: (cycles) => {
          this.rentCycles = cycles;
          if (
            !cycles.some(
              (cycle) => cycle.startDate === this.selectedRentCycleStart
            )
          ) {
            this.selectedRentCycleStart = cycles[0]?.startDate ?? '';
          }
          this.rentCyclesLoading = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.rentCyclesError =
            this.getBackendMessage(error) ??
            'Monthly rent history could not be loaded. Try again.';
          this.rentCyclesLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  selectRentCycle(event: Event): void {
    this.selectedRentCycleStart = (event.target as HTMLSelectElement).value;
  }

  private loadMembers(roomId: number): void {
    this.roomsApi
      .getMembers(roomId)
      .pipe(timeout({ first: 15000 }))
      .subscribe({
        next: (members) => {
          this.members = members;
          const userId = this.auth.currentUser?.userId;
          const membership = members.find(
            (member) => member.userId === userId
          );
          this.currentRole = membership?.role ?? null;
          this.currentRoomMemberId = membership?.roomMemberId ?? null;
          this.membersLoading = false;
          this.changeDetector.markForCheck();
          if (this.isAdmin) {
            this.refreshInvitations();
          }
          this.loadAbsenceData(members);
        },
        error: (error: unknown) => {
          this.membersError =
            error instanceof HttpErrorResponse && error.status === 403
              ? 'You do not have permission to view this room’s members.'
              : 'Room details are shown, but the member list could not be loaded. Try refreshing.';
          this.membersLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadAbsenceData(members: RoomMember[]): void {
    for (const member of members) {
      this.refreshAbsenceHistory(member.roomMemberId);
    }
  }

  refreshFinancials(): void {
    if (!this.room) {
      return;
    }
    const roomId = this.room.roomId;
    this.balancesLoading = true;
    this.settlementsLoading = true;
    this.balancesError = '';
    this.settlementsError = '';
    forkJoin({
      balances: this.roomsApi.getRoomBalances(roomId),
      suggestions: this.roomsApi.getSettlementSuggestions(roomId),
      settlements: this.roomsApi.getSettlements(
        roomId,
        this.settlementStatusFilter ?? undefined
      ),
    }).subscribe({
      next: ({ balances, suggestions, settlements }) => {
        this.balances = balances;
        this.settlementSuggestions = suggestions;
        this.settlements = settlements;
        this.balancesLoading = false;
        this.settlementsLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        const message =
          this.getBackendMessage(error) ??
          'Room balances or settlement information could not be loaded.';
        this.balancesError = message;
        this.settlementsError = message;
        this.balancesLoading = false;
        this.settlementsLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private getBackendMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }
    const message = error.error?.message;
    return typeof message === 'string' && message.length > 0 ? message : null;
  }

  refreshInvitations(): void {
    if (!this.room || !this.isAdmin) {
      return;
    }
    this.invitationsLoading = true;
    this.roomsApi
      .getRoomInvitations(
        this.room.roomId,
        this.invitationStatusFilter ?? undefined
      )
      .subscribe({
        next: (invitations) => {
          this.invitations = invitations;
          this.invitationsLoading = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.invitationError =
            this.getBackendMessage(error) ??
            'Room invitations could not be loaded.';
          this.invitationsLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private todayAsDateString(): string {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
