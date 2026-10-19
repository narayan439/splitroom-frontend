import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AbsenceSharingRules,
  ExpenseService
} from '../services/expense.service';

export interface Roommate {
  id: number;
  name: string;
  email: string;
  status: 'Active' | 'Temporarily Absent';
  balance: number;
  departureDate: string;
  returnDate: string;
  sharedCategories: string[];
  absenceSharing: AbsenceSharingRules;
}

interface AbsenceDraft {
  departureDate: string;
}

@Component({
  selector: 'app-roommates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roommates.html',
  styleUrl: './roommates.scss'
})
export class RoommatesComponent {
  constructor(private readonly expenseService: ExpenseService) {
    this.loadRoommateRules();
    this.syncRoommateRules();
  }

  readonly today = this.todayAsDateString();
  private readonly expenseCategories = [
    'Rent',
    'Electricity',
    'Groceries',
    'Water',
    'Other'
  ];

  roommates: Roommate[] = [
    {
      id: 1,
      name: 'Narayan',
      email: 'narayan@example.com',
      status: 'Active',
      balance: 1200,
      departureDate: '',
      returnDate: '',
      sharedCategories: [...this.expenseCategories],
      absenceSharing: this.defaultAbsenceSharing()
    },
    {
      id: 2,
      name: 'Rahul',
      email: 'rahul@example.com',
      status: 'Temporarily Absent',
      balance: 2300,
      departureDate: '2026-10-15',
      returnDate: '',
      sharedCategories: [...this.expenseCategories],
      absenceSharing: this.defaultAbsenceSharing()
    },
    {
      id: 3,
      name: 'Amit',
      email: 'amit@example.com',
      status: 'Active',
      balance: -500,
      departureDate: '',
      returnDate: '',
      sharedCategories: [...this.expenseCategories],
      absenceSharing: this.defaultAbsenceSharing()
    },
    {
      id: 4,
      name: 'Priya',
      email: 'priya@example.com',
      status: 'Active',
      balance: 0,
      departureDate: '',
      returnDate: '',
      sharedCategories: [...this.expenseCategories],
      absenceSharing: this.defaultAbsenceSharing()
    }
  ];

  absenceDrafts: Record<number, AbsenceDraft> = {};
  returnDateDrafts: Record<number, string> = {};
  absenceFormRoommateId: number | null = null;
  returnFormRoommateId: number | null = null;

  showForm = false;

  newName = '';
  newEmail = '';

  errorMessage = '';
  successMessage = '';

  get activeCount(): number {
    return this.roommates.filter(
      roommate => roommate.status === 'Active'
    ).length;
  }

  addRoommate(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.newName.trim() || !this.newEmail.trim()) {
      this.errorMessage = 'Enter roommate name and email.';
      return;
    }

    const roommate: Roommate = {
      id: Date.now(),
      name: this.newName.trim(),
      email: this.newEmail.trim(),
      status: 'Active',
      balance: 0,
      departureDate: '',
      returnDate: '',
      sharedCategories: [...this.expenseCategories],
      absenceSharing: this.defaultAbsenceSharing()
    };

    this.roommates.push(roommate);

    this.newName = '';
    this.newEmail = '';
    this.showForm = false;
    this.syncRoommateRules();

    this.successMessage = 'Roommate added successfully!';
  }

  beginAbsence(roommate: Roommate): void {
    this.errorMessage = '';
    this.absenceDrafts[roommate.id] = {
      departureDate: ''
    };
    this.absenceFormRoommateId = roommate.id;
  }

  cancelAbsence(): void {
    this.absenceFormRoommateId = null;
  }

  confirmAbsence(roommate: Roommate): void {
    this.errorMessage = '';
    this.successMessage = '';

    const draft = this.absenceDrafts[roommate.id];
    if (!draft || !this.isValidActualDate(draft.departureDate)) {
      this.errorMessage = 'Enter a valid actual departure date.';
      return;
    }

    if (draft.departureDate > this.today) {
      this.errorMessage = 'Departure date cannot be in the future.';
      return;
    }

    roommate.status = 'Temporarily Absent';
    roommate.departureDate = draft.departureDate;
    roommate.returnDate = '';
    this.absenceFormRoommateId = null;
    this.syncRoommateRules();
    this.successMessage = `${roommate.name} is marked absent from ${roommate.departureDate}.`;
  }

  beginReturn(roommate: Roommate): void {
    this.errorMessage = '';
    this.returnDateDrafts[roommate.id] = '';
    this.returnFormRoommateId = roommate.id;
  }

  cancelReturn(): void {
    this.returnFormRoommateId = null;
  }

  confirmReturn(roommate: Roommate): void {
    this.errorMessage = '';
    this.successMessage = '';
    const returnDate = this.returnDateDrafts[roommate.id];

    if (!this.isValidActualDate(returnDate)) {
      this.errorMessage = 'Enter a valid actual return date.';
      return;
    }

    if (returnDate < roommate.departureDate) {
      this.errorMessage = 'Return date cannot be before the departure date.';
      return;
    }

    if (returnDate > this.today) {
      this.errorMessage = 'Return date cannot be in the future.';
      return;
    }

    roommate.status = 'Active';
    roommate.returnDate = returnDate;
    this.returnFormRoommateId = null;
    this.syncRoommateRules();
    this.successMessage = `${roommate.name} returned on ${roommate.returnDate}.`;
  }

  syncRoommateRules(): void {
    this.expenseService.roommateRules = this.roommates.map((roommate) => ({
      name: roommate.name,
      status: roommate.status,
      departureDate: roommate.departureDate,
      returnDate: roommate.returnDate,
      sharedCategories: [...roommate.sharedCategories],
      absenceSharing: { ...roommate.absenceSharing },
      email: roommate.email
    }));
  }

  private loadRoommateRules(): void {
    const rulesByName = new Map(
      this.expenseService.roommateRules.map((rule) => [rule.name, rule])
    );
    const knownNames = new Set(this.roommates.map((roommate) => roommate.name));

    this.roommates = this.roommates.map((roommate) => {
      const rule = rulesByName.get(roommate.name);
      return rule
        ? {
            ...roommate,
            status: rule.status,
            departureDate: rule.departureDate,
            returnDate: rule.returnDate,
            sharedCategories: rule.sharedCategories.filter(
              category => category !== 'Internet'
            ),
            absenceSharing: { ...rule.absenceSharing }
          }
        : roommate;
    });

    let nextId =
      Math.max(0, ...this.roommates.map((roommate) => roommate.id)) + 1;
    for (const rule of this.expenseService.roommateRules) {
      if (!knownNames.has(rule.name)) {
        this.roommates.push({
          id: nextId++,
          name: rule.name,
          email: rule.email ?? '',
          status: rule.status,
          balance: 0,
          departureDate: rule.departureDate,
          returnDate: rule.returnDate,
          sharedCategories: rule.sharedCategories.filter(
            category => category !== 'Internet'
          ),
          absenceSharing: { ...rule.absenceSharing }
        });
      }
    }
  }

  private defaultAbsenceSharing(): AbsenceSharingRules {
    return {
      rentContinues: true,
      electricitySharedDuringAbsence: true
    };
  }

  private isValidActualDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  private todayAsDateString(): string {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

}