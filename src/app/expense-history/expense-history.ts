import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  CreateExpenseRequest,
  CreatedExpense,
  ExpenseCategory,
  RoomDetails,
  RoomExpense,
  RoomMember,
  RentCycleSummary,
} from '../rooms/room.models';
import { RoomService } from '../rooms/room.service';

interface RoomExpenseHistoryItem extends RoomExpense {
  roomId: number;
  roomName: string;
}

interface RoomRentCycleOption extends RentCycleSummary {
  roomId: number;
}

interface ExpenseImpact {
  memberId: number;
  memberName: string;
  shareAmount: number;
  paidAmount: number;
  netImpact: number;
}

type ExpensePayerSelection = number | 'none' | null;

@Component({
  selector: 'app-expense-history',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './expense-history.html',
  styleUrl: './expense-history.scss',
})
export class ExpenseHistory implements OnInit {
  private readonly roomsApi = inject(RoomService);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  rooms: RoomDetails[] = [];
  searchText = '';
  selectedCategory = 'All';
  expenses: RoomExpenseHistoryItem[] = [];
  rentCycles: RoomRentCycleOption[] = [];
  selectedCycleKey = 'ALL';
  selectedExpense: RoomExpenseHistoryItem | null = null;
  expenseDetails: CreatedExpense | null = null;
  detailMembers: RoomMember[] = [];
  detailCategories: ExpenseCategory[] = [];
  currentRole: RoomMember['role'] | null = null;
  detailLoading = false;
  detailError = '';
  editing = false;
  saving = false;
  editError = '';
  editMessage = '';
  selectedParticipantIds: number[] = [];
  readonly editForm = new FormGroup({
    categoryId: new FormControl<number | null>(null, Validators.required),
    paidByMemberId: new FormControl<ExpensePayerSelection>(
      null,
      Validators.required
    ),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(9999999999.99),
    ]),
    expenseDate: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  loading = true;
  errorMessage = '';

  get addExpenseRoom(): RoomDetails | null {
    return this.rooms[0] ?? null;
  }

  ngOnInit(): void {
    this.loadExpenses();
  }

  get categories(): string[] {
    return [...new Set(this.expenses.map((expense) => expense.categoryName))];
  }

  get filteredExpenses(): RoomExpenseHistoryItem[] {
    const search = this.searchText.trim().toLocaleLowerCase();
    const selectedCycle =
      this.rentCycles.find(
        (cycle) => this.rentCycleOptionKey(cycle) === this.selectedCycleKey
      ) ?? null;
    return this.expenses.filter((expense) => {
      const matchesSearch =
        !search ||
        expense.title.toLocaleLowerCase().includes(search) ||
        expense.payerName.toLocaleLowerCase().includes(search) ||
        expense.roomName.toLocaleLowerCase().includes(search);
      const matchesCategory =
        this.selectedCategory === 'All' ||
        expense.categoryName === this.selectedCategory;
      const matchesCycle =
        !selectedCycle ||
        (expense.roomId === selectedCycle.roomId &&
          expense.expenseDate >= selectedCycle.startDate &&
          expense.expenseDate <= selectedCycle.endDate);
      return matchesSearch && matchesCategory && matchesCycle;
    });
  }

  get totalAmount(): number {
    return this.filteredExpenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );
  }

  get expenseImpacts(): ExpenseImpact[] {
    const expense = this.expenseDetails;
    if (!expense) {
      return [];
    }

    const participantsById = new Map(
      expense.participants.map((participant) => [
        participant.roomMemberId,
        participant,
      ])
    );
    const memberIds = [...participantsById.keys()];
    const payerId = expense.paidBy?.roomMemberId ?? null;
    if (payerId !== null && !participantsById.has(payerId)) {
      memberIds.push(payerId);
    }

    return memberIds.flatMap((memberId) => {
      const participant = participantsById.get(memberId);
      const memberName = participant?.name ??
        (memberId === payerId
          ? expense.paidBy?.name
          : undefined);
      if (!memberName) {
        return [];
      }

      const shareAmount = participant?.shareAmount ?? 0;
      const paidAmount =
        payerId !== null && memberId === payerId ? expense.amount : 0;
      return [{
        memberId,
        memberName,
        shareAmount,
        paidAmount,
        netImpact: Math.round((paidAmount - shareAmount) * 100) / 100,
      }];
    });
  }

  formatExpenseImpact(amount: number): string {
    if (amount === 0) {
      return '₹0.00';
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    return `${amount > 0 ? '+' : '-'}₹${formatted}`;
  }

  rentCycleOptionKey(cycle: RoomRentCycleOption): string {
    return `${cycle.roomId}:${cycle.startDate}`;
  }

  loadExpenses(): void {
    this.loading = true;
    this.errorMessage = '';
    this.roomsApi.getMyRooms().subscribe({
      next: (rooms) => {
        this.rooms = rooms;
        this.loadRoomExpenses(rooms);
      },
      error: (error: unknown) => this.handleLoadError(error),
    });
  }

  toggleExpenseDetails(expense: RoomExpenseHistoryItem): void {
    if (this.selectedExpense?.expenseId === expense.expenseId) {
      this.selectedExpense = null;
      this.expenseDetails = null;
      this.editing = false;
      return;
    }

    this.selectedExpense = expense;
    this.expenseDetails = null;
    this.detailMembers = [];
    this.detailCategories = [];
    this.currentRole = null;
    this.detailLoading = true;
    this.detailError = '';
    this.editError = '';
    this.editMessage = '';
    this.editing = false;

    forkJoin({
      details: this.roomsApi.getExpenseDetails(
        expense.roomId,
        expense.expenseId
      ),
      members: this.roomsApi.getMembers(expense.roomId),
      categories: this.roomsApi.getExpenseCategories(expense.roomId),
    }).subscribe({
      next: ({ details, members, categories }) => {
        this.expenseDetails = details;
        this.detailMembers = members;
        this.detailCategories = categories;
        this.currentRole =
          members.find(
            (member) => member.userId === this.auth.currentUser?.userId
          )?.role ?? null;
        this.detailLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.detailError = this.getErrorMessage(
          error,
          'Expense details could not be loaded. Try again.'
        );
        this.detailLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  retryExpenseDetails(): void {
    const expense = this.selectedExpense;
    if (expense) {
      this.selectedExpense = null;
      this.toggleExpenseDetails(expense);
    }
  }

  beginEdit(): void {
    if (
      this.currentRole !== 'ADMIN' ||
      !this.expenseDetails ||
      !this.selectedExpense
    ) {
      return;
    }
    this.editForm.setValue({
      categoryId: this.expenseDetails.category.categoryId,
      paidByMemberId: this.expenseDetails.paidBy?.roomMemberId ?? 'none',
      title: this.expenseDetails.title,
      amount: this.expenseDetails.amount,
      expenseDate: this.expenseDetails.expenseDate,
    });
    this.selectedParticipantIds = this.expenseDetails.participants.map(
      (participant) => participant.roomMemberId
    );
    this.editError = '';
    this.editMessage = '';
    this.editing = true;
  }

  get isNoPayerSelected(): boolean {
    return this.editForm.controls.paidByMemberId.value === 'none';
  }

  onEditPayerSelectionChanged(): void {
    if (this.isNoPayerSelected) {
      this.selectedParticipantIds = this.detailMembers.map(
        (member) => member.roomMemberId
      );
    }
  }

  cancelEdit(): void {
    this.editing = false;
    this.editError = '';
  }

  isEditParticipantSelected(memberId: number): boolean {
    return this.selectedParticipantIds.includes(memberId);
  }

  toggleEditParticipant(memberId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selected = new Set(this.selectedParticipantIds);
    if (checked) {
      selected.add(memberId);
    } else {
      selected.delete(memberId);
    }
    this.selectedParticipantIds = [...selected];
  }

  toggleAllEditParticipants(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedParticipantIds = checked
      ? this.detailMembers.map((member) => member.roomMemberId)
      : [];
  }

  saveExpenseChanges(): void {
    const expense = this.selectedExpense;
    const details = this.expenseDetails;
    if (
      this.currentRole !== 'ADMIN' ||
      !expense ||
      !details ||
      this.editForm.invalid ||
      this.selectedParticipantIds.length === 0 ||
      this.saving
    ) {
      this.editForm.markAllAsTouched();
      if (this.selectedParticipantIds.length === 0) {
        this.editError = 'Select at least one member to share this expense.';
      }
      return;
    }

    const formValue = this.editForm.getRawValue();
    if (
      formValue.categoryId === null ||
      formValue.amount === null ||
      formValue.paidByMemberId === null ||
      (formValue.paidByMemberId !== 'none' &&
        !this.detailMembers.some(
          (member) => member.roomMemberId === formValue.paidByMemberId
        )) ||
      !this.detailCategories.some(
        (category) => category.categoryId === formValue.categoryId
      ) ||
      this.selectedParticipantIds.some(
        (id) => !this.detailMembers.some((member) => member.roomMemberId === id)
      )
    ) {
      this.editError = 'Choose valid room members and an expense category.';
      return;
    }

    const request: CreateExpenseRequest = {
      categoryId: formValue.categoryId,
      paidByMemberId:
        formValue.paidByMemberId === 'none'
          ? null
          : formValue.paidByMemberId,
      title: formValue.title.trim(),
      amount: formValue.amount,
      expenseDate: formValue.expenseDate,
      splitBetweenMemberIds: this.selectedParticipantIds,
    };
    this.saving = true;
    this.editError = '';
    this.editMessage = '';
    this.roomsApi
      .updateExpense(expense.roomId, expense.expenseId, request)
      .subscribe({
        next: (updated) => {
          this.expenseDetails = updated;
          this.selectedParticipantIds = updated.participants.map(
            (participant) => participant.roomMemberId
          );
          this.expenses = this.expenses.map((item) =>
            item.expenseId === updated.expenseId &&
            item.roomId === expense.roomId
              ? {
                  ...item,
                  title: updated.title,
                  amount: updated.amount,
                  expenseDate: updated.expenseDate,
                  categoryName: updated.category.categoryName,
                  payerName: updated.paidBy?.name ?? 'No one',
                  participantCount: updated.participants.length,
                }
              : item
          );
          this.saving = false;
          this.editing = false;
          this.editMessage = 'Expense updated.';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.editError = this.getErrorMessage(
            error,
            'Expense could not be updated. Please try again.'
          );
          this.saving = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadRoomExpenses(rooms: RoomDetails[]): void {
    if (rooms.length === 0) {
      this.expenses = [];
      this.rentCycles = [];
      this.selectedCycleKey = 'ALL';
      this.loading = false;
      this.changeDetector.markForCheck();
      return;
    }

    forkJoin(
      rooms.map((room) =>
        forkJoin({
          expenses: this.roomsApi.getRoomExpenses(room.roomId),
          cycles: this.roomsApi.getRoomRentCycles(room.roomId),
        }).pipe(
          map(({ expenses, cycles }) => ({
            expenses: expenses.map((expense) => ({
              ...expense,
              roomId: room.roomId,
              roomName: room.roomName,
            })),
            cycles: cycles.map((cycle) => ({
              ...cycle,
              roomId: room.roomId,
            })),
          }))
        )
      )
    ).subscribe({
      next: (groups) => {
        this.expenses = groups
          .flatMap((group) => group.expenses)
          .sort(
            (left, right) =>
              new Date(right.expenseDate).getTime() -
              new Date(left.expenseDate).getTime()
          );
        this.rentCycles = groups.flatMap((group) => group.cycles);
        const currentCycle = this.rentCycles.find(
          (cycle) => cycle.currentCycle
        );
        this.selectedCycleKey = currentCycle
          ? this.rentCycleOptionKey(currentCycle)
          : 'ALL';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => this.handleLoadError(error),
    });
  }

  private handleLoadError(error: unknown): void {
    this.errorMessage = this.getErrorMessage(
      error,
      'Expense history could not be loaded. Try again.'
    );
    this.loading = false;
    this.changeDetector.markForCheck();
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse &&
      typeof error.error?.message === 'string'
      ? error.error.message
      : fallback;
  }
}
