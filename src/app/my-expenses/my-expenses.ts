import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { RoomDetails, RentCycleSummary } from '../rooms/room.models';
import { RoomService } from '../rooms/room.service';

interface MyExpenseEntry {
  expenseId: number;
  title: string;
  amount: number;
  expenseDate: string;
  categoryName: string;
  paidByMe: boolean;
  paidAmount: number;
  shareAmount: number;
  netImpact: number;
}

@Component({
  selector: 'app-my-expenses',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-expenses.html',
  styleUrl: './my-expenses.scss',
})
export class MyExpensesComponent implements OnInit {
  private readonly roomsApi = inject(RoomService);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  room: RoomDetails | null = null;
  currentCycle: RentCycleSummary | null = null;
  rentCycles: RentCycleSummary[] = [];
  selectedCycleStart = '';
  myExpenses: MyExpenseEntry[] = [];
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadMyExpenses();
  }

  get currentCycleLabel(): string {
    return this.currentCycle?.startDate
      ? this.formatCycleLabel(this.currentCycle.startDate)
      : 'Current cycle';
  }

  formatCycleLabel(startDate: string): string {
    const [year, month, day] = startDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  }

  selectCycle(event: Event): void {
    this.selectedCycleStart = (event.target as HTMLSelectElement).value;
    this.currentCycle =
      this.rentCycles.find(
        (cycle) => cycle.startDate === this.selectedCycleStart
      ) ?? null;
    this.errorMessage = '';
    const currentUserId = this.auth.currentUser?.userId;
    if (
      !this.currentCycle ||
      !this.room ||
      currentUserId === undefined ||
      currentUserId === null
    ) {
      this.myExpenses = [];
      this.loading = false;
      this.changeDetector.markForCheck();
      return;
    }
    this.buildMyExpenseEntries(this.room.roomId, currentUserId);
  }

  get totalSpentThisCycle(): number {
    return this.myExpenses.reduce(
      (total, expense) => total + expense.paidAmount,
      0
    );
  }

  get totalShareThisCycle(): number {
    return this.myExpenses.reduce(
      (total, expense) => total + expense.shareAmount,
      0
    );
  }

  formatNetPosition(amount: number): string {
    if (amount === 0) {
      return '₹0.00';
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    return `${amount > 0 ? '+' : '-'}₹${formatted}`;
  }

  loadMyExpenses(): void {
    this.loading = true;
    this.errorMessage = '';
    this.roomsApi.getMyRooms().subscribe({
      next: (rooms) => {
        this.room = rooms[0] ?? null;
        if (!this.room) {
          this.loading = false;
          this.myExpenses = [];
          this.currentCycle = null;
          this.rentCycles = [];
          this.changeDetector.markForCheck();
          return;
        }
        const roomId = this.room.roomId;

        forkJoin({
          cycles: this.roomsApi.getRoomRentCycles(roomId),
          members: this.roomsApi.getMembers(roomId),
        }).subscribe({
          next: ({ cycles, members }) => {
            this.rentCycles = cycles;
            this.currentCycle =
              cycles.find((cycle) => cycle.currentCycle) ??
              cycles[0] ??
              null;
            this.selectedCycleStart = this.currentCycle?.startDate ?? '';
            const currentMember = members.find(
              (member) => member.userId === this.auth.currentUser?.userId
            );

            if (!this.currentCycle || !currentMember) {
              this.myExpenses = [];
              this.loading = false;
              this.errorMessage = !this.currentCycle
                ? 'No rent-cycle history is available yet.'
                : 'Your room membership could not be matched to the current account.';
              this.changeDetector.markForCheck();
              return;
            }

            this.buildMyExpenseEntries(roomId, currentMember.userId);
          },
          error: () => {
            this.loading = false;
            this.errorMessage =
              'Your expense history could not be loaded. Please try again.';
            this.changeDetector.markForCheck();
          },
        });
      },
      error: () => {
        this.loading = false;
        this.errorMessage =
          'Your room could not be loaded. Please check your connection and try again.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private buildMyExpenseEntries(roomId: number, currentUserId: number): void {
    const selectedCycle = this.currentCycle;
    this.loading = true;
    this.errorMessage = '';
    this.myExpenses = [];
    if (!selectedCycle || selectedCycle.expenses.length === 0) {
      this.myExpenses = [];
      this.loading = false;
      this.changeDetector.markForCheck();
      return;
    }

    forkJoin(
      selectedCycle.expenses.map((expense) =>
        this.roomsApi.getExpenseDetails(roomId, expense.expenseId)
      )
    ).subscribe({
      next: (details) => {
        if (this.currentCycle?.startDate !== selectedCycle.startDate) {
          return;
        }
        this.myExpenses = details
          .filter((detail) => {
            const paidByMe = detail.paidBy?.userId === currentUserId;
            const isParticipant = detail.participants.some(
              (participant) => participant.userId === currentUserId
            );
            return paidByMe || isParticipant;
          })
          .map((detail) => {
            const participant = detail.participants.find(
              (entry) => entry.userId === currentUserId
            );
            const shareAmount = participant?.shareAmount ?? 0;
            const paidAmount =
              detail.paidBy?.userId === currentUserId ? detail.amount : 0;
            return {
              expenseId: detail.expenseId,
              title: detail.title,
              amount: detail.amount,
              expenseDate: detail.expenseDate,
              categoryName: detail.category.categoryName,
              paidByMe: detail.paidBy?.userId === currentUserId,
              paidAmount,
              shareAmount,
              netImpact: paidAmount - shareAmount,
            } satisfies MyExpenseEntry;
          })
          .sort(
            (left, right) =>
              new Date(right.expenseDate).getTime() -
              new Date(left.expenseDate).getTime()
          );

        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (this.currentCycle?.startDate !== selectedCycle.startDate) {
          return;
        }
        this.myExpenses = [];
        this.loading = false;
        this.errorMessage =
          'Details for your expenses are temporarily unavailable.';
        this.changeDetector.markForCheck();
      },
    });
  }
}
