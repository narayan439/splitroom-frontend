import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  CreatedExpense,
  ExpenseCategory,
  RoomDetails,
  RoomMember,
} from '../rooms/room.models';
import { RoomService } from '../rooms/room.service';

type CategorySelection = number | 'other' | null;
type PayerSelection = number | 'none' | null;

interface ExpenseSharePreview {
  memberId: number;
  memberName: string;
  amount: number;
}

interface ExpenseContributionPreview {
  memberId: number;
  memberName: string;
  shareAmount: number;
  paidAmount: number;
  netImpact: number;
}

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './add-expense.html',
  styleUrl: './add-expense.scss',
})
export class AddExpenseComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly roomsApi = inject(RoomService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly form = new FormGroup({
    categoryId: new FormControl<CategorySelection>(null, Validators.required),
    customCategoryName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    paidByMemberId: new FormControl<PayerSelection>(null, Validators.required),
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(9999999999.99),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/),
    ]),
    expenseDate: new FormControl(this.todayAsDateString(), Validators.required),
    splitBetweenMemberIds: new FormControl<number[]>(
      [],
      {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(1)],
      }
    ),
  });

  roomId: number | null = null;
  room: RoomDetails | null = null;
  rooms: RoomDetails[] = [];
  categories: ExpenseCategory[] = [];
  members: RoomMember[] = [];
  currentMember: RoomMember | null = null;
  currentRole: RoomMember['role'] | null = null;
  savedExpense: CreatedExpense | null = null;
  membersLoading = true;
  membersError = '';
  customCategorySupported = false;
  loading = true;
  submitting = false;
  errorMessage = '';

  ngOnInit(): void {
    const routeRoomId = Number(this.route.snapshot.paramMap.get('roomId'));
    if (!Number.isSafeInteger(routeRoomId) || routeRoomId <= 0) {
      this.loadRooms();
      return;
    }

    this.roomId = routeRoomId;
    this.loadMembers(routeRoomId);
    forkJoin({
      room: this.roomsApi.getRoom(routeRoomId),
      categories: this.roomsApi.getExpenseCategories(routeRoomId),
    })
      .pipe(timeout({ first: 15000 }))
      .subscribe({
      next: ({ room, categories }) => {
        this.room = room;
        this.categories = this.uniqueCategories(categories);
        this.customCategorySupported = this.categories.some(
          (category) => category.categoryName.trim().toLocaleLowerCase() === 'other'
        );
        this.form.controls.categoryId.valueChanges.subscribe((selection) => {
          const customName = this.form.controls.customCategoryName;
          if (selection === 'other') {
            customName.addValidators(Validators.required);
          } else {
            customName.removeValidators(Validators.required);
            customName.setValue('', { emitEvent: false });
          }
          customName.updateValueAndValidity({ emitEvent: false });
          this.changeDetector.markForCheck();
        });
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage =
          this.getBackendMessage(error) ??
          'Room expense details could not be loaded. Check your room access and try again.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  get payerOptions(): RoomMember[] {
    if (this.currentRole === 'ADMIN') {
      return this.members;
    }
    return this.currentMember ? [this.currentMember] : [];
  }

  get isNoPayerSelected(): boolean {
    return this.form.controls.paidByMemberId.value === 'none';
  }

  onPayerSelectionChanged(): void {
    if (this.isNoPayerSelected) {
      this.form.controls.splitBetweenMemberIds.setValue(
        this.members.map((member) => member.roomMemberId)
      );
    }
  }

  get currentUserId(): number | null {
    return this.auth.currentUser?.userId ?? null;
  }

  get isOtherCategorySelected(): boolean {
    return this.form.controls.categoryId.value === 'other';
  }

  get selectableCategories(): ExpenseCategory[] {
    return this.categories.filter(
      (category) => category.categoryName.trim().toLocaleLowerCase() !== 'other'
    );
  }

  get selectedCategoryName(): string {
    if (this.isOtherCategorySelected) {
      return this.form.controls.customCategoryName.value.trim();
    }
    const categoryId = this.form.controls.categoryId.value;
    return (
      this.categories.find((category) => category.categoryId === categoryId)
        ?.categoryName ?? ''
    );
  }

  get customCategoryNameAlreadyExists(): boolean {
    const customName = this.form.controls.customCategoryName.value
      .trim()
      .toLocaleLowerCase();
    return (
      this.isOtherCategorySelected &&
      customName.length > 0 &&
      this.categories.some(
        (category) =>
          category.categoryName.trim().toLocaleLowerCase() === customName
      )
    );
  }

  get previewAmount(): number | null {
    const amount = this.form.controls.amount.value;
    return amount !== null && Number.isFinite(amount) && amount > 0
      ? Math.round(amount * 100) / 100
      : null;
  }

  get sharePreview(): ExpenseSharePreview[] {
    const selectedIds = this.form.controls.splitBetweenMemberIds.value;
    const totalAmount = this.previewAmount;
    if (totalAmount === null || selectedIds.length === 0) {
      return [];
    }

    const totalCents = Math.round(totalAmount * 100);
    const baseCents = Math.floor(totalCents / selectedIds.length);
    const remainderCents = totalCents % selectedIds.length;
    return selectedIds
      .map((memberId, index) => {
        const member = this.members.find(
          (roomMember) => roomMember.roomMemberId === memberId
        );
        return member
          ? {
              memberId,
              memberName: member.name,
              amount: (baseCents + (index < remainderCents ? 1 : 0)) / 100,
            }
          : null;
      })
      .filter((share): share is ExpenseSharePreview => share !== null);
  }

  get contributionPreview(): ExpenseContributionPreview[] {
    const totalAmount = this.previewAmount;
    const payerId = this.form.controls.paidByMemberId.value;
    if (totalAmount === null || payerId === null) {
      return [];
    }

    const sharesByMemberId = new Map(
      this.sharePreview.map((share) => [share.memberId, share.amount])
    );
    return this.members
      .filter(
        (member) =>
          sharesByMemberId.has(member.roomMemberId) ||
          (typeof payerId === 'number' && member.roomMemberId === payerId)
      )
      .map((member) => {
        const shareAmount = sharesByMemberId.get(member.roomMemberId) ?? 0;
        const paidAmount =
          typeof payerId === 'number' && member.roomMemberId === payerId
            ? totalAmount
            : 0;
        return {
          memberId: member.roomMemberId,
          memberName: member.name,
          shareAmount,
          paidAmount,
          netImpact:
            Math.round((paidAmount - shareAmount) * 100) / 100,
        };
      });
  }

  get savedContributionPreview(): ExpenseContributionPreview[] {
    const expense = this.savedExpense;
    if (!expense) {
      return [];
    }

    const sharesByMemberId = new Map(
      expense.participants.map((participant) => [
        participant.roomMemberId,
        participant.shareAmount,
      ])
    );
    const memberIds = [...sharesByMemberId.keys()];
    const payerId = expense.paidBy?.roomMemberId ?? null;
    if (payerId !== null && !sharesByMemberId.has(payerId)) {
      memberIds.push(payerId);
    }

    return memberIds.flatMap((memberId) => {
      const participant = expense.participants.find(
        (item) => item.roomMemberId === memberId
      );
      const member = this.members.find(
        (item) => item.roomMemberId === memberId
      );
      const memberName =
        participant?.name ??
        member?.name ??
        (payerId === memberId ? expense.paidBy?.name : undefined);
      if (!memberName) {
        return [];
      }
      const shareAmount = sharesByMemberId.get(memberId) ?? 0;
      const paidAmount =
        payerId !== null && memberId === payerId ? expense.amount : 0;
      return [
        {
          memberId,
          memberName,
          shareAmount,
          paidAmount,
          netImpact: Math.round((paidAmount - shareAmount) * 100) / 100,
        },
      ];
    });
  }

  get previewShareTotal(): number {
    const cents = this.sharePreview.reduce(
      (total, share) => total + Math.round(share.amount * 100),
      0
    );
    return cents / 100;
  }

  formatExpenseNetImpact(amount: number): string {
    if (amount === 0) {
      return '₹0.00';
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    return `${amount > 0 ? '+' : '-'}₹${formatted}`;
  }

  isParticipantSelected(roomMemberId: number): boolean {
    return this.form.controls.splitBetweenMemberIds.value.includes(
      roomMemberId
    );
  }

  get allParticipantsSelected(): boolean {
    return (
      this.members.length > 0 &&
      this.members.every((member) =>
        this.isParticipantSelected(member.roomMemberId)
      )
    );
  }

  toggleAllParticipants(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.controls.splitBetweenMemberIds.setValue(
      checked ? this.members.map((member) => member.roomMemberId) : []
    );
    this.form.controls.splitBetweenMemberIds.markAsTouched();
  }

  toggleParticipant(roomMemberId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selected = new Set(
      this.form.controls.splitBetweenMemberIds.value
    );
    if (checked) {
      selected.add(roomMemberId);
    } else {
      selected.delete(roomMemberId);
    }
    this.form.controls.splitBetweenMemberIds.setValue([...selected]);
    this.form.controls.splitBetweenMemberIds.markAsTouched();
  }

  submit(): void {
    this.errorMessage = '';
    if (
      !this.roomId ||
      this.form.invalid ||
      this.submitting ||
      this.savedExpense !== null ||
      this.membersLoading ||
      this.membersError
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const {
      categoryId,
      customCategoryName,
      paidByMemberId,
      amount,
      expenseDate,
      splitBetweenMemberIds,
    } = this.form.getRawValue();
    const validMemberIds = new Set(
      this.members.map((member) => member.roomMemberId)
    );
    if (
      categoryId === null ||
      (categoryId === 'other' &&
        (!this.customCategorySupported ||
          !customCategoryName.trim() ||
          this.customCategoryNameAlreadyExists)) ||
      (categoryId !== 'other' &&
        !this.categories.some((category) => category.categoryId === categoryId)) ||
      paidByMemberId === null ||
      (paidByMemberId !== 'none' && !this.payerOptions.some(
        (member) =>
          member.roomMemberId === paidByMemberId &&
          validMemberIds.has(member.roomMemberId)
      )) ||
      splitBetweenMemberIds.length === 0 ||
      splitBetweenMemberIds.some((id) => !validMemberIds.has(id)) ||
      amount === null ||
      !expenseDate
    ) {
      this.errorMessage =
        'Select a valid category, payer, date, and at least one room member. Custom categories require an existing room category named Other.';
      return;
    }

    const backendCategoryId =
      categoryId === 'other'
        ? this.categories.find(
            (category) => category.categoryName.trim().toLocaleLowerCase() === 'other'
          )?.categoryId
        : categoryId;
    if (backendCategoryId === undefined) {
      this.errorMessage =
        'Custom categories are not supported by the current expense API. Choose an existing room category.';
      return;
    }

    this.submitting = true;
    const payerMemberId =
      paidByMemberId === 'none' ? null : paidByMemberId;
    this.roomsApi
      .createExpense(this.roomId, {
        categoryId: backendCategoryId,
        paidByMemberId: payerMemberId,
        title: this.selectedCategoryName,
        amount,
        expenseDate,
        splitBetweenMemberIds,
      })
      .subscribe({
        next: (expense) => {
          this.savedExpense = expense;
          this.form.disable();
          this.submitting = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.errorMessage =
            this.getBackendMessage(error) ??
            'The expense could not be saved. Check the details and try again.';
          this.submitting = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  addAnotherExpense(): void {
    this.savedExpense = null;
    this.form.enable();
    this.form.reset({
      categoryId: null,
      customCategoryName: '',
      paidByMemberId: this.currentMember?.roomMemberId ?? null,
      amount: null,
      expenseDate: this.todayAsDateString(),
      splitBetweenMemberIds: [],
    });
    this.changeDetector.markForCheck();
  }

  retryMembers(): void {
    if (this.roomId) {
      this.loadMembers(this.roomId);
    }
  }

  private loadMembers(roomId: number): void {
    this.membersLoading = true;
    this.membersError = '';
    this.roomsApi
      .getMembers(roomId)
      .pipe(timeout({ first: 15000 }))
      .subscribe({
        next: (members) => {
          this.members = this.uniqueMembers(members);
          this.currentMember =
            this.members.find(
              (member) => member.userId === this.auth.currentUser?.userId
            ) ?? null;
          this.currentRole = this.currentMember?.role ?? null;
          if (this.isNoPayerSelected) {
            this.form.controls.splitBetweenMemberIds.setValue(
              this.members.map((member) => member.roomMemberId)
            );
          }
          const selectedPayer = this.form.controls.paidByMemberId.value;
          const availablePayer = this.payerOptions.some(
            (member) => member.roomMemberId === selectedPayer
          );
          if (!availablePayer) {
            this.form.controls.paidByMemberId.setValue(
              this.currentMember?.roomMemberId ?? null
            );
          }
          this.membersLoading = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.members = [];
          this.currentMember = null;
          this.currentRole = null;
          this.form.controls.paidByMemberId.setValue(null);
          this.membersError =
            this.getBackendMessage(error) ??
            'Room members could not be loaded. Check your room access and retry.';
          this.membersLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadRooms(): void {
    this.roomsApi.getMyRooms().pipe(timeout({ first: 15000 })).subscribe({
      next: (rooms) => {
        this.rooms = rooms;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage =
          this.getBackendMessage(error) ?? 'Your rooms could not be loaded.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private getBackendMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }
    const message = error.error?.message;
    return typeof message === 'string' && message.trim()
      ? message
      : null;
  }

  private uniqueMembers(members: RoomMember[]): RoomMember[] {
    const seen = new Set<number>();
    return members.filter((member) => {
      if (seen.has(member.userId)) {
        return false;
      }
      seen.add(member.userId);
      return true;
    });
  }

  private uniqueCategories(categories: ExpenseCategory[]): ExpenseCategory[] {
    const seen = new Set<string>();
    return categories.reduce<ExpenseCategory[]>((unique, category) => {
      const key = category.categoryName.trim().toLocaleLowerCase();
      if (!key || seen.has(key)) {
        return unique;
      }
      seen.add(key);
      unique.push({ ...category, categoryName: category.categoryName.trim() });
      return unique;
    }, []);
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
