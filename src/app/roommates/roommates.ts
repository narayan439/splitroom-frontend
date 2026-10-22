import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { defer, map, of, switchMap, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  RentCycleMemberPaymentStatus,
  RentCycleSummary,
  RoomDetails,
  RoomMember,
} from '../rooms/room.models';
import { RoomService } from '../rooms/room.service';

@Component({
  selector: 'app-roommates',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './roommates.html',
  styleUrl: './roommates.scss',
})
export class RoommatesComponent implements OnInit {
  private readonly roomsApi = inject(RoomService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);

  room: RoomDetails | null = null;
  members: RoomMember[] = [];
  rentCycles: RentCycleSummary[] = [];
  selectedCycleStart = '';
  historyLoading = false;
  historyError = '';
  memberStatuses: Record<number, RentCycleMemberPaymentStatus> = {};
  statusLoading = false;
  statusLoadError = '';
  statusSaveError = '';
  statusSavingMemberId: number | null = null;
  loading = true;
  errorMessage = '';

  get isAdmin(): boolean {
    const userId = this.auth.currentUser?.userId;
    return this.members.some(
      (member) => member.userId === userId && member.role === 'ADMIN'
    );
  }

  get selectedCycle(): RentCycleSummary | null {
    return (
      this.rentCycles.find(
        (cycle) => cycle.startDate === this.selectedCycleStart
      ) ?? null
    );
  }

  ngOnInit(): void {
    this.loadRoomMembers();
  }

  selectCycle(event: Event): void {
    this.selectedCycleStart = (event.target as HTMLSelectElement).value;
    this.loadMemberStatuses();
  }

  formatCycleLabel(startDate: string): string {
    const [year, month, day] = startDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
  }

  memberStatus(memberId: number): RentCycleMemberPaymentStatus {
    return this.memberStatuses[memberId] ?? 'PENDING';
  }

  saveMemberStatus(memberId: number, event: Event): void {
    const status = (event.target as HTMLSelectElement)
      .value as RentCycleMemberPaymentStatus;
    const cycle = this.selectedCycle;
    if (
      (status !== 'CLEAR' && status !== 'PENDING') ||
      !this.room ||
      !cycle ||
      !this.isAdmin ||
      this.statusLoading ||
      this.statusSavingMemberId !== null
    ) {
      return;
    }

    const roomId = this.room.roomId;
    const startDate = cycle.startDate;
    this.statusSavingMemberId = memberId;
    this.statusSaveError = '';
    this.roomsApi
      .updateRentCycleMemberStatus(roomId, startDate, memberId, status)
      .subscribe({
        next: (savedStatus) => {
          if (this.selectedCycleStart === startDate) {
            this.memberStatuses = {
              ...this.memberStatuses,
              [savedStatus.memberId]: savedStatus.status,
            };
          }
          this.statusSavingMemberId = null;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.statusSavingMemberId = null;
          this.statusSaveError =
            error instanceof HttpErrorResponse &&
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'The payment status could not be saved. Please try again.';
          this.changeDetector.markForCheck();
        },
      });
  }

  retryMemberStatuses(): void {
    this.loadMemberStatuses();
  }

  loadRoomMembers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.changeDetector.markForCheck();

    defer(() => this.roomsApi.getMyRooms())
      .pipe(
        timeout({ first: 15_000 }),
        switchMap((rooms) => {
          const currentRoom = rooms[0];
          if (!currentRoom) {
            return of({ room: null, members: [] as RoomMember[] });
          }
          return this.roomsApi.getMembers(currentRoom.roomId).pipe(
            timeout({ first: 15_000 }),
            map((members) => ({ room: currentRoom, members }))
          );
        })
      )
      .subscribe({
        next: ({ room, members }) => {
          this.room = room;
          this.members = members;
          this.loading = false;
          if (room && this.isAdmin) {
            this.loadRentHistory(room.roomId);
          }
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.errorMessage =
            error instanceof HttpErrorResponse &&
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'Room members could not be loaded. Check your connection and try again.';
          this.loading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadRentHistory(roomId: number): void {
    this.historyLoading = true;
    this.historyError = '';
    this.roomsApi
      .getRoomRentCycles(roomId)
      .pipe(timeout({ first: 15_000 }))
      .subscribe({
        next: (cycles) => {
          this.rentCycles = cycles;
          this.selectedCycleStart =
            cycles.find((cycle) => cycle.currentCycle)?.startDate ??
            cycles[0]?.startDate ??
            '';
          this.historyLoading = false;
          this.memberStatuses = {};
          if (this.selectedCycleStart) {
            this.loadMemberStatuses();
          }
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.historyError =
            'Monthly member balances could not be loaded. Please retry.';
          this.historyLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadMemberStatuses(): void {
    const roomId = this.room?.roomId;
    const cycle = this.selectedCycle;
    if (!roomId || !cycle) {
      this.memberStatuses = {};
      return;
    }

    const startDate = cycle.startDate;
    this.statusLoading = true;
    this.statusLoadError = '';
    this.statusSaveError = '';
    this.roomsApi
      .getRentCycleMemberStatuses(roomId, startDate)
      .pipe(timeout({ first: 15_000 }))
      .subscribe({
        next: (statuses) => {
          if (this.selectedCycleStart === startDate) {
            this.memberStatuses = Object.fromEntries(
              statuses.map((status) => [status.memberId, status.status])
            );
            this.statusLoading = false;
            this.changeDetector.markForCheck();
          }
        },
        error: () => {
          if (this.selectedCycleStart === startDate) {
            this.statusLoadError =
              'Payment statuses could not be loaded. Retry before changing a status.';
            this.statusLoading = false;
            this.changeDetector.markForCheck();
          }
        },
      });
  }
}
