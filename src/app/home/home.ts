import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Expense {
  title: string;
  category: string;
  amount: number;
  paidBy: string;
  date: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  roomName = '';
  month = '';

  totalExpenses = 0;
  myContribution = 0;
  myBalance = 0;
  monthlyRent = 0;
  rentDueDate = 1;

  expenses: Expense[] = [];
}