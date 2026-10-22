import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  MemberBalance,
  RoomDetails,
  RentCycleSummary,
} from './room.models';
import { RoomService } from './room.service';

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
  selector: 'app-room-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './room-dashboard.html',
  styleUrl: './room-dashboard.scss',
})
export class RoomDashboard implements OnInit, OnDestroy {
  private readonly roomsApi = inject(RoomService);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  room: RoomDetails | null = null;
  currentBalance: MemberBalance | null = null;
  currentCycle: RentCycleSummary | null = null;
  myExpenses: MyExpenseEntry[] = [];
  loading = true;
  summaryLoading = false;
  myExpensesLoading = false;
  summaryAvailable = false;
  errorMessage = '';
  summaryError = '';
  private cycleRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  get currentUserName(): string {
    return this.auth.currentUser?.name ?? 'there';
  }

  get totalRoomSpending(): number {
    return this.currentCycle?.expenseTotal ?? 0;
  }

  get signedBalance(): number | null {
    const memberId = this.currentBalance?.memberId;
    return memberId === undefined
      ? null
      : this.currentCycle?.members.find((member) => member.memberId === memberId)
          ?.netBalance ?? null;
  }

  get previousCycleNetPosition(): number | null {
    return this.currentBalance && this.signedBalance !== null
      ? this.currentBalance.netBalance - this.signedBalance
      : null;
  }

  get currentCycleMonthLabel(): string {
    return this.currentCycle?.startDate
      ? new Date(this.currentCycle.startDate).toLocaleString('en-IN', {
          month: 'long',
        })
      : 'Current cycle';
  }

  ngOnInit(): void {
    this.loadRoom();
    this.scheduleCycleRefresh();
  }

  ngOnDestroy(): void {
    if (this.cycleRefreshTimer !== null) {
      clearTimeout(this.cycleRefreshTimer);
    }
  }

  loadRoom(): void {
    this.loading = true;
    this.errorMessage = '';
    this.roomsApi.getMyRooms().subscribe({
      next: (rooms) => {
        this.room = rooms[0] ?? null;
        this.loading = false;
        if (this.room) {
          this.loadFinancialSummary(this.room);
        } else {
          this.currentBalance = null;
          this.currentCycle = null;
          this.myExpenses = [];
          this.summaryAvailable = false;
          this.summaryLoading = false;
          this.myExpensesLoading = false;
        }
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.errorMessage =
          'Your room could not be loaded. Check your connection and try again.';
        this.loading = false;
        this.summaryLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  formatNetPosition(balance: number | null): string {
    if (balance === null || balance === 0) {
      return '₹0.00';
    }
    const amount = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(balance));
    return `${balance > 0 ? '+' : '-'}₹${amount}`;
  }

  private loadFinancialSummary(room: RoomDetails): void {
    this.summaryLoading = true;
    this.myExpensesLoading = true;
    this.summaryAvailable = false;
    this.summaryError = '';
    this.myExpenses = [];
    forkJoin({
      members: this.roomsApi.getMembers(room.roomId),
      balances: this.roomsApi.getRoomBalances(room.roomId),
      rentCycles: this.roomsApi.getRoomRentCycles(room.roomId),
    }).subscribe({
      next: ({ members, balances, rentCycles }) => {
        const currentMember = members.find(
          (member) => member.userId === this.auth.currentUser?.userId
        );
        this.currentBalance = currentMember
          ? balances.find(
              (balance) => balance.memberId === currentMember.roomMemberId
            ) ?? null
          : null;
        this.currentCycle =
          rentCycles.find((cycle) => cycle.currentCycle) ?? null;
        this.summaryAvailable = Boolean(
          currentMember && this.currentBalance && this.currentCycle
        );
        this.summaryError = !currentMember
          ? 'Your room membership could not be matched to the signed-in account.'
          : !this.currentBalance
            ? 'Your balance summary is not available from the room balance service.'
            : !this.currentCycle
              ? 'The current rent-cycle summary is not available. Try refreshing.'
            : '';
        if (this.currentCycle) {
          this.loadMyExpenses(room.roomId);
        } else {
          this.myExpenses = [];
          this.myExpensesLoading = false;
        }
        this.summaryLoading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.summaryError =
          'Financial summary could not be loaded. Retry to refresh expenses and balances.';
        this.summaryLoading = false;
        this.myExpensesLoading = false;
        this.myExpenses = [];
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadMyExpenses(roomId: number): void {
    if (!this.currentCycle || this.currentCycle.expenses.length === 0) {
      this.myExpenses = [];
      this.myExpensesLoading = false;
      this.changeDetector.markForCheck();
      return;
    }

    const currentUserId = this.auth.currentUser?.userId;
    if (currentUserId === undefined || currentUserId === null) {
      this.myExpenses = [];
      this.myExpensesLoading = false;
      this.changeDetector.markForCheck();
      return;
    }

    forkJoin(
      this.currentCycle.expenses.map((expense) =>
        this.roomsApi.getExpenseDetails(roomId, expense.expenseId)
      )
    ).subscribe({
      next: (details) => {
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
            const paidAmount = detail.paidBy?.userId === currentUserId ? detail.amount : 0;
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
        this.myExpensesLoading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.myExpenses = [];
        this.myExpensesLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  formatExpenseNet(amount: number): string {
    if (amount === 0) {
      return '₹0.00';
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    return `${amount > 0 ? '+' : '-'}₹${formatted}`;
  }

  private scheduleCycleRefresh(): void {
    const now = new Date();
    let nextCycleStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      7,
      0,
      0,
      0,
      0
    );
    if (now.getTime() >= nextCycleStart.getTime()) {
      nextCycleStart = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        7,
        0,
        0,
        0,
        0
      );
    }
    this.cycleRefreshTimer = setTimeout(() => {
      if (this.room) {
        this.loadFinancialSummary(this.room);
      }
      this.scheduleCycleRefresh();
    }, nextCycleStart.getTime() - now.getTime());
  }
}
