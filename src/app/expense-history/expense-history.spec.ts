import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { RoomService } from '../rooms/room.service';
import { ExpenseHistory } from './expense-history';

describe('ExpenseHistory', () => {
  it('saves selected participants when editing an unpaid expense', async () => {
    const updateExpense = vi.fn(() =>
      of({
        expenseId: 77,
        title: 'Electricity',
        amount: 120,
        expenseDate: '2026-10-21',
        createdAt: '2026-10-21T10:00:00',
        category: { categoryId: 8, categoryName: 'Electricity' },
        paidBy: null,
        participants: [
          {
            roomMemberId: 32,
            userId: 8,
            name: 'Rahul',
            email: 'rahul@example.com',
            shareAmount: 120,
          },
        ],
      })
    );

    await TestBed.configureTestingModule({
      imports: [ExpenseHistory],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: { userId: 7 } },
        },
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () => of([]),
            updateExpense,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExpenseHistory);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.currentRole = 'ADMIN';
    component.selectedExpense = {
      expenseId: 77,
      title: 'Electricity',
      amount: 120,
      expenseDate: '2026-10-21',
      categoryName: 'Electricity',
      payerName: 'No one',
      participantCount: 2,
      roomId: 12,
      roomName: 'Shared Flat',
    };
    component.expenseDetails = {
      expenseId: 77,
      title: 'Electricity',
      amount: 120,
      expenseDate: '2026-10-21',
      createdAt: '2026-10-21T10:00:00',
      category: { categoryId: 8, categoryName: 'Electricity' },
      paidBy: null,
      participants: [
        {
          roomMemberId: 31,
          userId: 7,
          name: 'Narayan',
          email: 'narayan@example.com',
          shareAmount: 60,
        },
        {
          roomMemberId: 32,
          userId: 8,
          name: 'Rahul',
          email: 'rahul@example.com',
          shareAmount: 60,
        },
      ],
    };
    component.detailMembers = [
      {
        roomMemberId: 31,
        userId: 7,
        name: 'Narayan',
        email: 'narayan@example.com',
        role: 'ADMIN',
      },
      {
        roomMemberId: 32,
        userId: 8,
        name: 'Rahul',
        email: 'rahul@example.com',
        role: 'MEMBER',
      },
    ];
    component.detailCategories = [
      { categoryId: 8, categoryName: 'Electricity' },
    ];

    component.beginEdit();
    fixture.detectChanges();
    component.onEditPayerSelectionChanged();
    component.toggleEditParticipant(31, checkboxEvent(false));
    fixture.detectChanges();

    const participantCheckboxes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        '.edit-form fieldset input[type="checkbox"]'
      )
    );
    expect(participantCheckboxes.every((checkbox) => !checkbox.disabled)).toBe(
      true
    );
    expect(component.selectedParticipantIds).toEqual([32]);

    component.saveExpenseChanges();
    expect(updateExpense).toHaveBeenCalledWith(12, 77, {
      categoryId: 8,
      paidByMemberId: null,
      title: 'Electricity',
      amount: 120,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [32],
    });
    expect(component.expenseDetails?.participants.map((member) => member.roomMemberId))
      .toEqual([32]);
  });

  function checkboxEvent(checked: boolean): Event {
    const event = new Event('change');
    Object.defineProperty(event, 'target', {
      value: { checked },
    });
    return event;
  }
});
