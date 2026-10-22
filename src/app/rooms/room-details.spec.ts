import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { from, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { RoomDetails } from './room-details';
import { RoomService } from './room.service';

describe('RoomDetails', () => {
  it('renders room details after the asynchronous room response', async () => {
    const room = {
      roomId: 12,
      roomName: 'Bhubaneswar Flat',
      createdBy: {
        userId: 7,
        name: 'Test User',
        email: 'test@example.com',
      },
      createdAt: '2026-10-21T10:00:00',
      memberCount: 1,
    };
    const members = [
      {
        roomMemberId: 31,
        userId: 7,
        name: 'Test User',
        email: 'test@example.com',
        role: 'MEMBER' as const,
      },
    ];
    let markAbsentCalls = 0;
    const roomsApi = {
      getRoom: () => from(Promise.resolve(room)),
      getMembers: () => of(members),
      getExpenseCategories: () => of([]),
      getAbsenceHistory: () =>
        of([
          {
            absenceId: 71,
            memberId: 31,
            memberName: 'Test User',
            departureDate: '2026-10-20',
            returnDate: null,
            reason: 'Travel',
            status: 'ACTIVE' as const,
            rules: [],
          },
        ]),
      getRoomExpenses: () => of([]),
      getRoomRentCycles: () =>
        of([
          {
            startDate: '2026-10-07',
            endDate: '2026-11-06',
            currentCycle: true,
            rentAmount: 400,
            expenseTotal: 400,
            rentPaymentStatus: 'NOT_TRACKED' as const,
            expenses: [
              {
                expenseId: 91,
                title: 'October rent',
                amount: 400,
                expenseDate: '2026-10-07',
                categoryName: 'Rent',
                payerName: 'Test User',
                participantCount: 1,
              },
            ],
            members: [
              {
                memberId: 31,
                memberName: 'Test User',
                shareAmount: 400,
                paidAmount: 400,
                netBalance: 0,
                completedSettlementsSent: 0,
                completedSettlementsReceived: 0,
              },
            ],
          },
        ]),
      getRoomBalances: () => of([]),
      getSettlementSuggestions: () =>
        of({ roomId: 12, roomName: 'Bhubaneswar Flat', suggestions: [] }),
      getSettlements: () => of([]),
      getRoomInvitations: () => of([]),
      markAbsent: () => {
        markAbsentCalls += 1;
        return of({} as never);
      },
    };

    await TestBed.configureTestingModule({
      imports: [RoomDetails],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'roomId' ? '12' : null) },
            },
          },
        },
        { provide: RoomService, useValue: roomsApi },
        {
          provide: AuthService,
          useValue: {
            currentUser: { userId: 7, name: 'Test User' },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RoomDetails);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Loading room details'
    );

    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Bhubaneswar Flat');
    expect(page.textContent).not.toContain('Loading room details');
    expect(page.textContent).toContain('Test User');
    expect(page.textContent).toContain('Absent');
    expect(page.textContent).toContain('Monthly rent & expense history');
    expect(page.textContent).toContain('Rent payment status');
    expect(page.textContent).toContain('October rent');
    expect(page.textContent).toContain('Not tracked');
    expect(page.querySelector('input[type="date"]')).toBeNull();
    expect(page.textContent).not.toContain('Balances & settlements');
    expect(page.textContent).not.toContain('Suggested settlements');
    expect(
      Array.from(page.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('Mark Present')
      )
    ).toBe(false);
    fixture.componentInstance.toggleMemberAbsence(
      fixture.componentInstance.members[0]
    );
    expect(markAbsentCalls).toBe(0);
  });

  it('lets an admin toggle a member absent and present without date fields', async () => {
    const room = {
      roomId: 12,
      roomName: 'Bhubaneswar Flat',
      createdBy: {
        userId: 7,
        name: 'Admin User',
        email: 'admin@example.com',
      },
      createdAt: '2026-10-21T10:00:00',
      memberCount: 1,
    };
    const members = [
      {
        roomMemberId: 31,
        userId: 7,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'ADMIN' as const,
      },
    ];
    let history: {
      absenceId: number;
      memberId: number;
      memberName: string;
      departureDate: string;
      returnDate: string | null;
      reason: string | null;
      status: 'ACTIVE' | 'RETURNED';
      rules: never[];
    }[] = [];
    const absenceRequests: { departureDate: string; reason: null }[] = [];
    const returnRequests: { returnDate: string }[] = [];
    const roomsApi = {
      getRoom: () => of(room),
      getMembers: () => of(members),
      getAbsenceHistory: () => of(history),
      getRoomExpenses: () => of([]),
      getRoomRentCycles: () => of([]),
      getRoomBalances: () => of([]),
      getSettlementSuggestions: () =>
        of({ roomId: 12, roomName: room.roomName, suggestions: [] }),
      getSettlements: () => of([]),
      getRoomInvitations: () => of([]),
      markAbsent: (_roomId: number, memberId: number, request: { departureDate: string; reason: null }) => {
        absenceRequests.push(request);
        history = [{
          absenceId: 72,
          memberId,
          memberName: 'Admin User',
          departureDate: request.departureDate,
          returnDate: null,
          reason: null,
          status: 'ACTIVE',
          rules: [],
        }];
        return of(history[0]);
      },
      markReturned: (_roomId: number, _memberId: number, _absenceId: number, request: { returnDate: string }) => {
        returnRequests.push(request);
        history = [{
          ...history[0],
          returnDate: request.returnDate,
          status: 'RETURNED',
        }];
        return of(history[0]);
      },
    };

    await TestBed.configureTestingModule({
      imports: [RoomDetails],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'roomId' ? '12' : null) },
            },
          },
        },
        { provide: RoomService, useValue: roomsApi },
        {
          provide: AuthService,
          useValue: {
            currentUser: { userId: 7, name: 'Admin User' },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RoomDetails);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    let page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('input[type="date"]')).toBeNull();
    expect(page.textContent).toContain('Present');
    const markAbsentButton = Array.from(page.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Mark Absent'
    );
    expect(markAbsentButton).toBeDefined();
    markAbsentButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(absenceRequests).toHaveLength(1);

    page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Absent');
    const markPresentButton = Array.from(page.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Mark Present'
    );
    expect(markPresentButton).toBeDefined();
    markPresentButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(returnRequests).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Present');
  });
});
