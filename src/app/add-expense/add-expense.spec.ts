import { TestBed } from '@angular/core/testing';
import { AddExpenseComponent } from './add-expense';
import { ExpenseService } from '../services/expense.service';

describe('AddExpenseComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddExpenseComponent]
    }).compileComponents();
  });

  it('should save the selected roommates to shared expense history', () => {
    const fixture = TestBed.createComponent(AddExpenseComponent);
    const component = fixture.componentInstance;
    const expenseService = TestBed.inject(ExpenseService);
    const initialCount = expenseService.expenses.length;

    component.title = 'Electricity bill';
    component.category = 'Electricity';
    component.amount = 2400;
    component.paidBy = 'Narayan';
    expenseService.roommateRules = [
      {
        name: 'Narayan',
        status: 'Active',
        departureDate: '',
        returnDate: '',
        sharedCategories: ['Rent', 'Electricity'],
        absenceSharing: {
          rentContinues: true,
          electricitySharedDuringAbsence: true
        }
      },
      {
        name: 'Rahul',
        status: 'Temporarily Absent',
        departureDate: '2026-10-15',
        returnDate: '',
        sharedCategories: ['Rent'],
        absenceSharing: {
          rentContinues: true,
          electricitySharedDuringAbsence: true
        }
      },
      {
        name: 'Amit',
        status: 'Active',
        departureDate: '',
        returnDate: '',
        sharedCategories: ['Rent', 'Electricity'],
        absenceSharing: {
          rentContinues: true,
          electricitySharedDuringAbsence: true
        }
      }
    ];
    component.updateEligibleRoommates();

    component.saveExpense();

    const savedExpense = expenseService.expenses[0];
    expect(expenseService.expenses).toHaveLength(initialCount + 1);
    expect(savedExpense.title).toBe('Electricity bill');
    expect(savedExpense.paidBy).toBe('Narayan');
    expect(savedExpense.roommates).toEqual(['Narayan', 'Amit']);
    expect(expenseService.getExpenseShares(savedExpense)).toEqual([
      { roommate: 'Narayan', share: 1200 },
      { roommate: 'Amit', share: 1200 }
    ]);
  });

  it('should automatically select away roommates for checked categories only', () => {
    const fixture = TestBed.createComponent(AddExpenseComponent);
    const component = fixture.componentInstance;
    const expenseService = TestBed.inject(ExpenseService);

    expenseService.roommateRules = [
      {
        name: 'Narayan',
        status: 'Active',
        departureDate: '',
        returnDate: '',
        sharedCategories: ['Rent', 'Electricity'],
        absenceSharing: {
          rentContinues: true,
          electricitySharedDuringAbsence: true
        }
      },
      {
        name: 'Rahul',
        status: 'Temporarily Absent',
        departureDate: '2026-10-15',
        returnDate: '',
        sharedCategories: ['Rent'],
        absenceSharing: {
          rentContinues: true,
          electricitySharedDuringAbsence: true
        }
      },
      {
        name: 'Amit',
        status: 'Active',
        departureDate: '',
        returnDate: '',
        sharedCategories: ['Rent', 'Electricity'],
        absenceSharing: {
          rentContinues: true,
          electricitySharedDuringAbsence: true
        }
      }
    ];

    component.category = 'Electricity';
    component.paidBy = 'Narayan';
    component.updateEligibleRoommates();
    expect(component.selectedRoommates.map(roommate => roommate.name)).toEqual([
      'Narayan',
      'Amit'
    ]);

    component.category = 'Rent';
    component.updateEligibleRoommates();
    expect(component.selectedRoommates.map(roommate => roommate.name)).toEqual([
      'Narayan',
      'Rahul',
      'Amit'
    ]);
  });

  it('should show one roommate-selection option and allow manual selection', () => {
    const fixture = TestBed.createComponent(AddExpenseComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.split-option')).toHaveLength(1);
    expect(compiled.querySelector('.split-option')?.textContent).toContain(
      'Select roommates'
    );
    expect(compiled.querySelectorAll('.roommate-item input[type="checkbox"]')).toHaveLength(
      component.roommates.length
    );

    const deselectedRoommate = component.roommates[0];
    deselectedRoommate.selected = false;
    expect(component.selectedRoommates).not.toContain(deselectedRoommate);
  });
});
