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

  expenses: Expense[] = [];

  addExpense(expense: Omit<Expense, 'id'>): void {
    const newExpense: Expense = {
      id: Date.now(),
      ...expense
    };

    this.expenses.unshift(newExpense);
  }
}