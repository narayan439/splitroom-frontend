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
  roomName = 'Room 204';
  month = 'October 2026';

  totalExpenses = 18500;
  myContribution = 6500;
  myBalance = 1200;
  monthlyRent = 12000;
 rentDueDate = 1;

  expenses: Expense[] = [
    {
      title: 'Room Rent',
      category: 'Rent',
      amount: 12000,
      paidBy: 'Rahul',
      date: 'Oct 01'
    },
    {
      title: 'Electricity Bill',
      category: 'Electricity',
      amount: 3500,
      paidBy: 'Narayan',
      date: 'Oct 05'
    },
    {
      title: 'Vegetables',
      category: 'Groceries',
      amount: 3000,
      paidBy: 'Amit',
      date: 'Oct 08'
    }
  ];
}