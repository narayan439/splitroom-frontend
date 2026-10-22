import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { RoomService } from '../rooms/room.service';
import { RoommatesComponent } from './roommates';

describe('RoommatesComponent', () => {
  it('automatically loads and displays the current room members', async () => {
    const updateRentCycleMemberStatus = vi.fn((..._args: unknown[]) =>
      of({ memberId: 21, status: 'CLEAR' as const })
    );
    await TestBed.configureTestingModule({
      imports: [RoommatesComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: { userId: 7 } },
        },
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () =>
              of([
                {
                  roomId: 12,
                  roomName: 'Shared Flat',
                  createdBy: {
                    userId: 7,
                    name: 'Test User',
                    email: 'test@example.com',
                  },
                  createdAt: '2026-10-21T10:00:00',
                  memberCount: 3,
                },
              ]),
            getMembers: () =>
              of([
                {
                  roomMemberId: 21,
                  userId: 7,
                  name: 'Test User',
                  email: 'test@example.com',
                  role: 'ADMIN' as const,
                },
                {
                  roomMemberId: 22,
                  userId: 8,
                  name: 'Roommate',
                  email: 'roommate@example.com',
                  role: 'MEMBER' as const,
                },
              ]),
            getRoomRentCycles: () =>
              of([
                {
                  startDate: '2026-10-07',
                  endDate: '2026-11-06',
                  currentCycle: true,
                  rentAmount: 0,
                  expenseTotal: 100,
                  rentPaymentStatus: 'NOT_TRACKED' as const,
                  expenses: [],
                  members: [
                    {
                      memberId: 21,
                      memberName: 'Test User',
                      shareAmount: 50,
                      paidAmount: 0,
                      netBalance: -50,
                      completedSettlementsSent: 0,
                      completedSettlementsReceived: 0,
                    },
                    {
                      memberId: 22,
                      memberName: 'Roommate',
                      shareAmount: 50,
                      paidAmount: 100,
                      netBalance: 50,
                      completedSettlementsSent: 0,
                      completedSettlementsReceived: 0,
                    },
                  ],
                },
              ]),
            getRentCycleMemberStatuses: () =>
              of([{ memberId: 21, status: 'PENDING' as const }]),
            updateRentCycleMemberStatus,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RoommatesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Shared Flat');
    expect(page.textContent).toContain('Room members');
    expect(page.textContent).toContain('Test User');
    expect(page.textContent).toContain('Roommate');
    expect(page.textContent).toContain('ADMIN');
    expect(page.textContent).toContain('Monthly member balances');
    expect(page.textContent).toContain('Payment status');
    expect(page.textContent).toContain('Pending');
    expect(page.textContent).toContain(
      'It does not create a settlement or change expenses, shares, or balances.'
    );
    const statusSelect = page.querySelector(
      '[aria-label="Payment status for Test User"]'
    ) as HTMLSelectElement;
    statusSelect.value = 'CLEAR';
    statusSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(updateRentCycleMemberStatus).toHaveBeenCalledWith(
      12,
      '2026-10-07',
      21,
      'CLEAR'
    );
    expect(statusSelect.value).toBe('CLEAR');
    expect(statusSelect.disabled).toBe(true);
    expect(page.querySelector('a[href="/rooms/12"]')).not.toBeNull();
    expect(page.textContent).not.toContain('Choose a room');
  });
});
