import { Injectable } from '@angular/core';

export interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  paidBy: string;
  date: string;
  roommates: string[];
}

export interface RoommateRule {
  name: string;
  status: 'Active' | 'Temporarily Absent';
  departureDate: string;
  returnDate: string;
  sharedCategories: string[];
  absenceSharing: AbsenceSharingRules;
  email?: string;
}

export interface AbsenceSharingRules {
  rentContinues: boolean;
  electricitySharedDuringAbsence: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private nextId = 5;

  roommateRules: RoommateRule[] = [
    {
      name: 'Narayan',
      email: 'narayan@example.com',
      status: 'Active',
      departureDate: '',
      returnDate: '',
      sharedCategories: ['Rent', 'Electricity', 'Groceries', 'Water', 'Other'],
      absenceSharing: this.defaultAbsenceSharing()
    },
    {
      name: 'Rahul',
      email: 'rahul@example.com',
      status: 'Temporarily Absent',
      departureDate: '2026-10-15',
      returnDate: '',
      sharedCategories: ['Rent', 'Electricity', 'Groceries', 'Water', 'Other'],
      absenceSharing: this.defaultAbsenceSharing()
    },
    {
      name: 'Amit',
      email: 'amit@example.com',
      status: 'Active',
      departureDate: '',
      returnDate: '',
      sharedCategories: ['Rent', 'Electricity', 'Groceries', 'Water', 'Other'],
      absenceSharing: this.defaultAbsenceSharing()
    },
    {
      name: 'Priya',
      email: 'priya@example.com',
      status: 'Active',
      departureDate: '',
      returnDate: '',
      sharedCategories: ['Rent', 'Electricity', 'Groceries', 'Water', 'Other'],
      absenceSharing: this.defaultAbsenceSharing()
    }
  ];

  readonly expenses: Expense[] = [
    {
      id: 1,
      title: 'Monthly Rent',
      category: 'Rent',
      amount: 12000,
      paidBy: 'Narayan',
      date: '2026-10-01',
      roommates: ['Narayan', 'Rahul', 'Amit', 'Priya']
    },
    {
      id: 2,
      title: 'Electricity Bill',
      category: 'Electricity',
      amount: 2400,
      paidBy: 'Rahul',
      date: '2026-10-05',
      roommates: ['Narayan', 'Rahul', 'Amit']
    },
    {
      id: 3,
      title: 'Vegetables',
      category: 'Groceries',
      amount: 800,
      paidBy: 'Amit',
      date: '2026-10-08',
      roommates: ['Narayan', 'Rahul', 'Amit']
    },
    {
      id: 4,
      title: 'Internet Bill',
      category: 'Internet',
      amount: 1000,
      paidBy: 'Narayan',
      date: '2026-10-10',
      roommates: ['Narayan', 'Rahul', 'Amit', 'Priya']
    }
  ];

  addExpense(expense: Omit<Expense, 'id'>): Expense {
    const savedExpense: Expense = {
      ...expense,
      id: this.nextId++,
      roommates: [...expense.roommates]
    };
    this.expenses.unshift(savedExpense);
    return savedExpense;
  }

  getExpenseShares(expense: Expense): { roommate: string; share: number }[] {
    const totalAmount = Number(expense.amount);
    const roommates = expense.roommates;

    if (
      roommates.length === 0 ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      return [];
    }

    const sharePerPerson = totalAmount / roommates.length;

    return roommates.map((roommate) => ({
      roommate,
      share: sharePerPerson
    }));
  }

  getEligibleRoommates(
    category: string,
    payer: string,
    expenseDate = this.todayAsDateString()
  ): string[] {
    return this.roommateRules
      .filter((roommate) => {
        if (roommate.name === payer) {
          return true;
        }

        if (!roommate.sharedCategories.includes(category)) {
          return false;
        }

        if (!roommate.departureDate) {
          return true;
        }

        const isDuringAbsence =
          expenseDate >= roommate.departureDate &&
          (!roommate.returnDate || expenseDate < roommate.returnDate);
        if (!isDuringAbsence) {
          return true;
        }

        return this.sharesCategoryDuringAbsence(
          roommate,
          category,
          expenseDate
        );
      })
      .map((roommate) => roommate.name);
  }

  private defaultAbsenceSharing(): AbsenceSharingRules {
    return {
      rentContinues: true,
      electricitySharedDuringAbsence: true
    };
  }

  private sharesCategoryDuringAbsence(
    roommate: RoommateRule,
    category: string,
    expenseDate: string
  ): boolean {
    switch (category) {
      case 'Rent':
        return roommate.absenceSharing.rentContinues;
      case 'Electricity':
        return roommate.absenceSharing.electricitySharedDuringAbsence;
      default:
        return false;
    }
  }

  private todayAsDateString(): string {
    const today = new Date();
    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');
  }
}
