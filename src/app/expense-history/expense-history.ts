import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Expense, ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-expense-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-history.html',
  styleUrl: './expense-history.scss'
})
export class ExpenseHistory {
  constructor(private readonly expenseService: ExpenseService) {}

  searchText = '';
  selectedCategory = 'All';

  get expenses(): Expense[] {
    return this.expenseService.expenses;
  }

  get categories(): string[] {
    return [...new Set(this.expenses.map(expense => expense.category))];
  }

  get filteredExpenses(): Expense[] {
    return this.expenses.filter(expense => {
      const matchesSearch =
        expense.title.toLowerCase().includes(
          this.searchText.toLowerCase()
        ) ||
        expense.paidBy.toLowerCase().includes(
          this.searchText.toLowerCase()
        );

      const matchesCategory =
        this.selectedCategory === 'All' ||
        expense.category === this.selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }

  get totalAmount(): number {
    return this.filteredExpenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );
  }

  getShare(expense: Expense): number {
    return this.expenseService.getExpenseShares(expense)[0]?.share ?? 0;
  }

  getShares(expense: Expense): { roommate: string; share: number }[] {
    return this.expenseService.getExpenseShares(expense);
  }
}