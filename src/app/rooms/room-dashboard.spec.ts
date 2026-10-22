import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { RoomDashboard } from './room-dashboard';
import { RoomService } from './room.service';

describe('RoomDashboard', () => {
  async function renderDashboard(
    netBalance: number,
    cycleNetPosition = netBalance,
    cycleSpending = 200
  ) {
    await TestBed.configureTestingModule({
      imports: [RoomDashboard],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: { userId: 1, name: 'Jordan' } },
        },
        {
          provide: RoomService,
          useValue: {
            getMembers: () =>
              of([
                {
                  roomMemberId: 4,
                  userId: 1,
                  name: 'Jordan',
                  email: 'jordan@example.com',
                  role: 'ADMIN',
                },
              ]),
            getRoomBalances: () =>
              of([
                {
                  roomId: 3,
                  roomName: 'Maple House',
                  memberId: 4,
                  memberName: 'Jordan',
                  totalPaid: 500,
                  totalShare: 300,
                  netBalance,
                },
              ]),
            getRoomExpenses: () =>
              of([
                {
                  expenseId: 19,
                  title: 'Electricity',
                  amount: 125.5,
                  expenseDate: '2026-10-20',
                  categoryName: 'Electricity',
                  payerName: 'Jordan',
                  participantCount: 2,
                },
                {
                  expenseId: 20,
                  title: 'Groceries',
                  amount: 74.5,
                  expenseDate: '2026-10-21',
                  categoryName: 'Groceries',
                  payerName: 'Jordan',
                  participantCount: 2,
                },
              ]),
            getRoomRentCycles: () =>
              of([
                {
                  startDate: '2026-10-07',
                  endDate: '2026-11-06',
                  currentCycle: true,
                  rentAmount: 0,
                  expenseTotal: cycleSpending,
                  rentPaymentStatus: 'NOT_TRACKED' as const,
                  expenses: [
                    {
                      expenseId: 19,
                      title: 'Electricity',
                      amount: 125.5,
                      expenseDate: '2026-10-20',
                      categoryName: 'Electricity',
                      payerName: 'Jordan',
                      participantCount: 2,
                    },
                    {
                      expenseId: 20,
                      title: 'Groceries',
                      amount: 74.5,
                      expenseDate: '2026-10-21',
                      categoryName: 'Groceries',
                      payerName: 'Jordan',
                      participantCount: 2,
                    },
                  ],
                  members: [
                    {
                      memberId: 4,
                      memberName: 'Jordan',
                      shareAmount: 300,
                      paidAmount: 500,
                      netBalance: cycleNetPosition,
                      completedSettlementsSent: 0,
                      completedSettlementsReceived: 0,
                    },
                  ],
                },
              ]),
            getExpenseDetails: (_roomId: number, expenseId: number) =>
              of({
                expenseId,
                title: expenseId === 19 ? 'Electricity' : 'Groceries',
                amount: expenseId === 19 ? 125.5 : 74.5,
                expenseDate:
                  expenseId === 19 ? '2026-10-20' : '2026-10-21',
                createdAt: '2026-10-21T10:00:00',
                category: {
                  categoryId: expenseId === 19 ? 8 : 9,
                  categoryName:
                    expenseId === 19 ? 'Electricity' : 'Groceries',
                },
                paidBy: {
                  roomMemberId: 4,
                  userId: 1,
                  name: 'Jordan',
                  email: 'jordan@example.com',
                },
                participants: [
                  {
                    roomMemberId: 4,
                    userId: 1,
                    name: 'Jordan',
                    email: 'jordan@example.com',
                    shareAmount: expenseId === 19 ? 62.75 : 37.25,
                  },
                ],
              }),
            getMyRooms: () =>
              of([
                {
                  roomId: 3,
                  roomName: 'Maple House',
                  createdBy: {
                    userId: 1,
                    name: 'Jordan',
                    email: 'jordan@example.com',
                  },
                  createdAt: '2026-10-21T10:00:00',
                  memberCount: 2,
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RoomDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows current-cycle spending and net position in its financial summary', async () => {
    const fixture = await renderDashboard(25);
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('Total Room Spending');
    expect(page.textContent).toContain('₹200.00');
    expect(page.textContent).toContain('Your Net Position');
    expect(page.querySelectorAll('.summary-card')).toHaveLength(2);
    expect(page.querySelector('.balance-list')).toBeNull();
    expect(page.textContent).not.toContain('Owed to you');
    expect(page.textContent).not.toContain('Suggested settlements');
    expect(page.textContent).not.toContain('Balances & settlements');
    expect(page.textContent).not.toContain('Room invitations');
    expect(page.textContent).toContain('+₹25.00');
    expect(page.querySelector('.balance-positive')).not.toBeNull();
  });

  it('shows a negative balance in red', async () => {
    const fixture = await renderDashboard(-18.5);
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('-₹18.50');
    expect(page.querySelector('.balance-negative')).not.toBeNull();
  });

  it('shows zero without a sign when settled up', async () => {
    const fixture = await renderDashboard(0);
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('₹0.00');
    expect(page.textContent).not.toContain('+₹0.00');
    expect(page.textContent).not.toContain('-₹0.00');
    expect(page.querySelector('.balance-settled')).not.toBeNull();
  });

  it('shows a zero current cycle while keeping previous-cycle balance visible', async () => {
    const fixture = await renderDashboard(315.25, 0, 0);
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('₹0.00');
    expect(page.textContent).toContain('Previous cycles net: +₹315.25');
  });

  it('shows the requested cycle spending and net after shares', async () => {
    const fixture = await renderDashboard(0, -13333.36, 70000);
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('₹70,000.00');
    expect(page.textContent).toContain('-₹13,333.36');
    expect(page.querySelector('.balance-negative')).not.toBeNull();
  });
});
