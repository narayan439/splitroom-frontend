import { Expense, ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  let service: ExpenseService;

  beforeEach(() => {
    service = new ExpenseService();
  });

  it('starts without seeded expense or roommate demo data', () => {
    expect(service.expenses).toEqual([]);
    expect(service.roommateRules).toEqual([]);
  });

  it('should calculate equal roommate shares for an expense', () => {
    const expense: Expense = {
      id: 10,
      title: 'Electricity bill',
      category: 'Electricity',
      amount: 2400,
      paidBy: 'Narayan',
      date: '2026-10-05',
      roommates: ['Narayan', 'Rahul', 'Amit']
    };

    expect(service.getExpenseShares(expense)).toEqual([
      { roommate: 'Narayan', share: 800 },
      { roommate: 'Rahul', share: 800 },
      { roommate: 'Amit', share: 800 }
    ]);
  });

  it('should not calculate shares for empty or non-positive expenses', () => {
    const expense: Expense = {
      id: 11,
      title: 'No participants',
      category: 'Other',
      amount: 120,
      paidBy: 'Narayan',
      date: '2026-10-05',
      roommates: []
    };

    expect(service.getExpenseShares(expense)).toEqual([]);
    expect(
      service.getExpenseShares({ ...expense, amount: 0, roommates: ['Narayan'] })
    ).toEqual([]);
  });

  it('should save a snapshot of roommates to shared history', () => {
    const roommates = ['Narayan', 'Rahul', 'Amit'];
    const saved = service.addExpense({
      title: 'Electricity bill',
      category: 'Electricity',
      amount: 2400,
      paidBy: 'Narayan',
      date: '2026-10-05',
      roommates
    });
    roommates.pop();

    expect(service.expenses[0]).toEqual({
      ...saved,
      id: 1,
      roommates: ['Narayan', 'Rahul', 'Amit']
    });
    expect(service.getExpenseShares(saved).map(item => item.share)).toEqual([
      800, 800, 800
    ]);
  });

  it('should apply recorded absence dates and sharing rules to expense dates', () => {
    service.roommateRules = [
      {
        name: 'Narayan',
        status: 'Active',
        departureDate: '',
        returnDate: '',
        sharedCategories: ['Rent', 'Electricity', 'Groceries'],
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
        sharedCategories: ['Rent', 'Electricity', 'Groceries'],
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
        sharedCategories: ['Rent', 'Electricity', 'Groceries'],
        absenceSharing: {
          rentContinues: true,
          electricitySharedDuringAbsence: true
        }
      }
    ];

    expect(service.getEligibleRoommates('Rent', 'Narayan', '2026-10-20')).toEqual([
      'Narayan',
      'Rahul',
      'Amit'
    ]);
    expect(service.getEligibleRoommates('Electricity', 'Narayan', '2026-10-20')).toEqual([
      'Narayan',
      'Rahul',
      'Amit'
    ]);
    expect(service.getEligibleRoommates('Electricity', 'Narayan', '2026-11-10')).toEqual([
      'Narayan',
      'Rahul',
      'Amit'
    ]);
    expect(service.getEligibleRoommates('Groceries', 'Narayan', '2026-10-20')).toEqual([
      'Narayan',
      'Amit'
    ]);
    expect(service.getEligibleRoommates('Electricity', 'Narayan', '2026-10-14')).toEqual([
      'Narayan',
      'Rahul',
      'Amit'
    ]);
  });

  it('should restore sharing on and after the actual return date and always include the payer', () => {
    service.roommateRules = [
      {
        name: 'Rahul',
        status: 'Active',
        departureDate: '2026-10-15',
        returnDate: '2026-11-10',
        sharedCategories: ['Rent', 'Electricity'],
        absenceSharing: {
          rentContinues: false,
          electricitySharedDuringAbsence: false
        }
      }
    ];

    expect(service.getEligibleRoommates('Electricity', 'Narayan', '2026-11-09')).toEqual([]);
    expect(service.getEligibleRoommates('Electricity', 'Narayan', '2026-11-10')).toEqual([
      'Rahul'
    ]);
    expect(service.getEligibleRoommates('Electricity', 'Rahul', '2026-10-20')).toEqual([
      'Rahul'
    ]);
  });
});
