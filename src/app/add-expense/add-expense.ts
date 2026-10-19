import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../services/expense.service';

interface Roommate {
  id: number;
  name: string;
  selected: boolean;
}

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-expense.html',
  styleUrl: './add-expense.scss'
})
export class AddExpenseComponent {
  roommates: Roommate[];
  eligibleRoommates: string[] = [];

  constructor(private readonly expenseService: ExpenseService) {
    this.roommates = this.expenseService.roommateRules.map(
      (roommate, index) => ({
        id: index + 1,
        name: roommate.name,
        selected: false
      })
    );
    this.updateEligibleRoommates();
  }

  title = '';
  category = 'Groceries';
  customCategory = '';
  amount: number | null = null;
  paidBy = 'Narayan';
  expenseDate = new Date().toISOString().slice(0, 10);

  categories = [
    'Rent',
    'Electricity',
    'Groceries',
    'Water',
    'Other'
  ];

  errorMessage = '';
  successMessage = '';

  // Payers can include a roommate who is currently away.
  get presentRoommates(): Roommate[] {
    return this.roommates;
  }

  // Roommates who will share the expense
  get selectedRoommates(): Roommate[] {
    return this.roommates.filter(
      roommate =>
        this.eligibleRoommates.includes(roommate.name) &&
        roommate.selected
    );
  }

  get finalCategory(): string {
    return this.category === 'Other'
      ? this.customCategory.trim()
      : this.category;
  }

  get sharePerPerson(): number {
    if (!this.amount || this.selectedRoommates.length === 0) {
      return 0;
    }

    return this.amount / this.selectedRoommates.length;
  }

  updateEligibleRoommates(): void {
    if (!this.finalCategory || !this.paidBy) {
      this.eligibleRoommates = [];
    } else {
      this.eligibleRoommates = this.expenseService.getEligibleRoommates(
        this.finalCategory,
        this.paidBy,
        this.expenseDate
      );
    }

    this.roommates.forEach(roommate => {
      roommate.selected = this.eligibleRoommates.includes(roommate.name);
    });
  }

  saveExpense(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.title.trim()) {
      this.errorMessage = 'Enter an expense title.';
      return;
    }

    if (!this.amount || this.amount <= 0) {
      this.errorMessage = 'Enter an amount greater than zero.';
      return;
    }

    if (!this.finalCategory) {
      this.errorMessage = 'Enter or select an expense category.';
      return;
    }

    if (this.selectedRoommates.length === 0) {
      this.errorMessage = 'Select at least one eligible roommate.';
      return;
    }

    const paidByRoommate = this.roommates.find(
      roommate => roommate.name === this.paidBy
    );

    if (!paidByRoommate) {
      this.errorMessage = 'Select a roommate who paid for this expense.';
      return;
    }

    this.expenseService.addExpense({
      title: this.title.trim(),
      category: this.finalCategory,
      amount: Number(this.amount),
      paidBy: paidByRoommate.name,
      date: this.expenseDate,
      roommates: this.selectedRoommates.map(roommate => roommate.name)
    });

    this.successMessage = 'Expense added successfully!';

    this.title = '';
    this.amount = null;
    this.category = 'Groceries';
    this.customCategory = '';
    this.updateEligibleRoommates();
  }
}