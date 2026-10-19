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

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {

  expenses: Expense[] = [
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
    }
  ];

  addExpense(expense: Omit<Expense, 'id'>): void {
    const newExpense: Expense = {
      id: Date.now(),
      ...expense
    };

    this.expenses.unshift(newExpense);
  }
}