import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AddExpenseComponent } from './add-expense';

@Component({ standalone: true, template: '' })
class EmptyRouteComponent {}

describe('AddExpenseComponent', () => {
  let httpTesting: HttpTestingController;
  let fixture: ComponentFixture<AddExpenseComponent>;
  let component: AddExpenseComponent;
  const apiUrl = `${environment.apiUrl.replace(/\/+$/, '')}/api`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddExpenseComponent],
      providers: [
        provideRouter([
          { path: 'rooms/:roomId', component: EmptyRouteComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'roomId' ? '12' : null),
              },
            },
          },
        },
        {
          provide: AuthService,
          useValue: { currentUser: { userId: 7 } },
        },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddExpenseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    loadRoomData();
  });

  afterEach(() => httpTesting.verify());

  it('requires positive amount, category, payer, date, and participants', () => {
    expect(component.form.invalid).toBe(true);
    component.form.controls.amount.setValue(0);
    expect(component.form.controls.amount.invalid).toBe(true);

    component.form.patchValue({
      categoryId: 8,
      paidByMemberId: 31,
      amount: 2400,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [],
    });
    expect(component.form.invalid).toBe(true);
    expect(component.form.controls.amount.valid).toBe(true);
  });

  it('does not let a non-admin select another member as payer', () => {
    component.currentRole = 'MEMBER';
    component.form.setValue({
      categoryId: 8,
      customCategoryName: '',
      paidByMemberId: 32,
      amount: 250,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [31],
    });

    component.submit();

    expect(component.errorMessage).toContain('Select a valid category, payer');
    httpTesting.expectNone(`${apiUrl}/rooms/12/expenses`);
  });

  it('shows all room members in the Paid by list for an admin', () => {
    fixture.detectChanges();
    const payerSelect: HTMLSelectElement =
      fixture.nativeElement.querySelector('#paidByMemberId');

    expect(payerSelect).not.toBeNull();
    expect(component.form.controls.paidByMemberId.value).toBe(31);
    expect(Array.from(payerSelect.options).map((option) => option.textContent?.trim()))
      .toEqual([
        'Select payer',
        'No one (shared expense)',
        'Narayan (you)',
        'Rahul',
      ]);
  });

  it('limits a non-admin payer list to the authenticated member', () => {
    component.members = component.members.map((member) => ({
      ...member,
      role: 'MEMBER',
    }));
    component.currentMember = component.members[0];
    component.currentRole = 'MEMBER';
    fixture.detectChanges();

    const payerSelect: HTMLSelectElement =
      fixture.nativeElement.querySelector('#paidByMemberId');
    expect(Array.from(payerSelect.options).map((option) => option.textContent?.trim()))
      .toEqual(['Select payer', 'No one (shared expense)', 'Narayan (you)']);
  });

  it('lets a member record an unpaid expense split across every room member', () => {
    component.currentRole = 'MEMBER';
    component.form.patchValue({
      categoryId: 8,
      paidByMemberId: 'none',
      amount: 90,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [31],
    });
    component.onPayerSelectionChanged();
    fixture.detectChanges();

    expect(component.form.controls.splitBetweenMemberIds.value).toEqual([
      31, 32,
    ]);
    expect(component.allParticipantsSelected).toBe(true);

    component.submit();
    const request = httpTesting.expectOne(`${apiUrl}/rooms/12/expenses`);
    expect(request.request.body.paidByMemberId).toBeNull();
    expect(request.request.body.splitBetweenMemberIds).toEqual([31, 32]);
    request.flush({
      expenseId: 95,
      title: 'Electricity',
      amount: 90,
      expenseDate: '2026-10-21',
      createdAt: '2026-10-21T10:00:00',
      category: { categoryId: 8, categoryName: 'Electricity' },
      paidBy: null,
      participants: [
        {
          roomMemberId: 31,
          userId: 7,
          name: 'Narayan',
          email: 'narayan@example.com',
          shareAmount: 45,
        },
        {
          roomMemberId: 32,
          userId: 8,
          name: 'Rahul',
          email: 'rahul@example.com',
          shareAmount: 45,
        },
      ],
    });

    expect(component.savedContributionPreview.map((entry) => entry.netImpact))
      .toEqual([-45, -45]);
  });

  it('lets the user deselect roommates when no one is marked as payer', () => {
    component.form.patchValue({
      categoryId: 8,
      paidByMemberId: 'none',
      amount: 100,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [31],
    });
    component.onPayerSelectionChanged();
    fixture.detectChanges();

    const participantCheckboxes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        '.member-list input[type="checkbox"]'
      )
    );
    expect(participantCheckboxes).toHaveLength(2);
    expect(participantCheckboxes.every((checkbox) => !checkbox.disabled)).toBe(
      true
    );

    component.toggleParticipant(31, checkboxEvent(false));
    fixture.detectChanges();
    expect(component.form.controls.splitBetweenMemberIds.value).toEqual([32]);
    expect(component.sharePreview.map((share) => share.memberId)).toEqual([32]);
    expect(component.sharePreview[0].amount).toBe(100);

    component.submit();
    const request = httpTesting.expectOne(`${apiUrl}/rooms/12/expenses`);
    expect(request.request.body.paidByMemberId).toBeNull();
    expect(request.request.body.splitBetweenMemberIds).toEqual([32]);
    request.flush({
      expenseId: 96,
      title: 'Electricity',
      amount: 100,
      expenseDate: '2026-10-21',
      createdAt: '2026-10-21T10:00:00',
      category: { categoryId: 8, categoryName: 'Electricity' },
      paidBy: null,
      participants: [
        {
          roomMemberId: 32,
          userId: 8,
          name: 'Rahul',
          email: 'rahul@example.com',
          shareAmount: 100,
        },
      ],
    });
  });

  it('renders every unique room member and updates the rounded split preview', () => {
    component.form.controls.amount.setValue(100.01);
    const checkedEvent = new Event('change');
    Object.defineProperty(checkedEvent, 'target', {
      value: { checked: true },
    });
    component.toggleParticipant(31, checkedEvent);
    component.toggleParticipant(32, checkedEvent);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('.member-list .member-option')).toHaveLength(2);
    expect(page.textContent).toContain('Narayan');
    expect(page.textContent).toContain('Rahul');
    expect(component.sharePreview.map((share) => share.amount)).toEqual([
      50.01,
      50,
    ]);
    expect(component.previewShareTotal).toBe(100.01);
    expect(page.querySelectorAll('.share-preview-list li')).toHaveLength(2);
  });

  it('selects and deselects all room members from the sharing list', () => {
    fixture.detectChanges();
    const selectAll: HTMLInputElement = fixture.nativeElement.querySelector(
      '[aria-label="Select all room members"]'
    );

    expect(selectAll.checked).toBe(false);
    selectAll.click();
    fixture.detectChanges();
    expect(component.form.controls.splitBetweenMemberIds.value).toEqual([
      31, 32,
    ]);
    expect(selectAll.checked).toBe(true);

    selectAll.click();
    fixture.detectChanges();
    expect(component.form.controls.splitBetweenMemberIds.value).toEqual([]);
    expect(selectAll.checked).toBe(false);
  });

  it('previews the payer credit and each member share for an equal split', () => {
    component.members = [
      ...component.members,
      {
        roomMemberId: 34,
        userId: 9,
        name: 'Sam',
        email: 'sam@example.com',
        role: 'MEMBER',
      },
      {
        roomMemberId: 35,
        userId: 10,
        name: 'Taylor',
        email: 'taylor@example.com',
        role: 'MEMBER',
      },
      {
        roomMemberId: 36,
        userId: 11,
        name: 'Alex',
        email: 'alex@example.com',
        role: 'MEMBER',
      },
    ];
    component.form.patchValue({
      amount: 10000,
      paidByMemberId: 31,
      splitBetweenMemberIds: [31, 32, 34, 35, 36],
    });
    fixture.detectChanges();

    expect(component.contributionPreview.map((entry) => entry.netImpact)).toEqual([
      8000,
      -2000,
      -2000,
      -2000,
      -2000,
    ]);
    expect(component.formatExpenseNetImpact(8000)).toBe('+₹8,000.00');
    expect(component.formatExpenseNetImpact(-2000)).toBe('-₹2,000.00');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      '+₹8,000.00'
    );
  });

  it('shows the backend-returned shares after the expense is saved', () => {
    component.members = [
      component.members[0],
      component.members[1],
      {
        roomMemberId: 33,
        userId: 9,
        name: 'hadi',
        email: 'hadi@example.com',
        role: 'MEMBER',
      },
    ];
    component.currentMember = component.members[0];
    component.form.setValue({
      categoryId: 8,
      customCategoryName: '',
      paidByMemberId: 33,
      amount: 20000,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [33, 31, 32],
    });

    component.submit();
    const request = httpTesting.expectOne(`${apiUrl}/rooms/12/expenses`);
    request.flush({
      expenseId: 90,
      title: 'Rent',
      amount: 20000,
      expenseDate: '2026-10-21',
      createdAt: '2026-10-21T10:00:00',
      category: { categoryId: 8, categoryName: 'Rent' },
      paidBy: {
        roomMemberId: 33,
        userId: 9,
        name: 'hadi',
        email: 'hadi@example.com',
      },
      participants: [
        {
          roomMemberId: 33,
          userId: 9,
          name: 'hadi',
          email: 'hadi@example.com',
          shareAmount: 6666.67,
        },
        {
          roomMemberId: 31,
          userId: 7,
          name: 'Narayan',
          email: 'narayan@example.com',
          shareAmount: 6666.67,
        },
        {
          roomMemberId: 32,
          userId: 8,
          name: 'rahul',
          email: 'rahul@example.com',
          shareAmount: 6666.66,
        },
      ],
    });
    fixture.detectChanges();

    expect(
      component.savedContributionPreview.map((entry) => [
        entry.memberName,
        entry.shareAmount,
        entry.netImpact,
      ])
    ).toEqual([
      ['hadi', 6666.67, 13333.33],
      ['Narayan', 6666.67, -6666.67],
      ['rahul', 6666.66, -6666.66],
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Saved expense split'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      '-₹6,666.67'
    );
    expect(component.form.disabled).toBe(true);

    component.addAnotherExpense();
    expect(component.savedExpense).toBeNull();
    expect(component.form.enabled).toBe(true);
    expect(component.form.controls.splitBetweenMemberIds.value).toEqual([]);
  });

  it('does not pretend an unsupported custom category can be saved', () => {
    component.form.controls.categoryId.setValue('other');
    component.form.controls.customCategoryName.setValue('Household supplies');
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain(
      'The current API cannot create custom categories.'
    );
    expect(
      (page.querySelector('.save-button') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('uses an existing Other category and sends the entered name in the required title field', () => {
    component.categories = [
      ...component.categories,
      { categoryId: 9, categoryName: 'Other' },
    ];
    component.customCategorySupported = true;
    component.form.setValue({
      categoryId: 'other',
      customCategoryName: 'Household supplies',
      paidByMemberId: 31,
      amount: 85,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [31],
    });

    component.submit();

    const request = httpTesting.expectOne(`${apiUrl}/rooms/12/expenses`);
    expect(request.request.body).toEqual({
      categoryId: 9,
      paidByMemberId: 31,
      title: 'Household supplies',
      amount: 85,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [31],
    });
    request.flush({});
  });

  it('submits exact room member IDs and only one request while saving', async () => {
    component.form.setValue({
      categoryId: 8,
      customCategoryName: '',
      paidByMemberId: 31,
      amount: 1200.5,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [32],
    });

    component.submit();
    component.submit();

    const request = httpTesting.expectOne(`${apiUrl}/rooms/12/expenses`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      categoryId: 8,
      paidByMemberId: 31,
      title: 'Electricity',
      amount: 1200.5,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [32],
    });
    expect(component.submitting).toBe(true);

    request.flush({
      expenseId: 88,
      title: 'Electricity bill',
      amount: 1200.5,
      expenseDate: '2026-10-21',
      createdAt: '2026-10-21T10:00:00',
      category: { categoryId: 8, categoryName: 'Electricity' },
      paidBy: {
        roomMemberId: 31,
        userId: 7,
        name: 'Narayan',
        email: 'narayan@example.com',
      },
      participants: [],
    });
    await fixture.whenStable();
    expect(component.submitting).toBe(false);
  });

  it('allows an admin to submit the selected room member ID as payer', () => {
    component.form.setValue({
      categoryId: 8,
      customCategoryName: '',
      paidByMemberId: 32,
      amount: 120,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [31],
    });

    component.submit();
    const request = httpTesting.expectOne(`${apiUrl}/rooms/12/expenses`);
    expect(request.request.body.paidByMemberId).toBe(32);
    request.flush({});
  });

  it('shows backend failures and permits a retry', () => {
    component.form.setValue({
      categoryId: 8,
      customCategoryName: '',
      paidByMemberId: 31,
      amount: 400,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [31],
    });

    component.submit();
    const failedRequest = httpTesting.expectOne(
      `${apiUrl}/rooms/12/expenses`
    );
    failedRequest.flush(
      { message: 'The selected category does not belong to this room.' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(component.errorMessage).toContain(
      'The selected category does not belong to this room.'
    );
    expect(component.submitting).toBe(false);

    component.submit();
    const retryRequest = httpTesting.expectOne(
      `${apiUrl}/rooms/12/expenses`
    );
    expect(retryRequest.request.body.paidByMemberId).toBe(31);
    expect(retryRequest.request.body.splitBetweenMemberIds).toEqual([31]);
    retryRequest.flush({
      expenseId: 89,
      title: 'Electricity',
      amount: 400,
      expenseDate: '2026-10-21',
      createdAt: '2026-10-21T10:00:00',
      category: { categoryId: 8, categoryName: 'Electricity' },
      paidBy: {
        roomMemberId: 32,
        userId: 8,
        name: 'Rahul',
        email: 'rahul@example.com',
      },
      participants: [],
    });
  });

  function loadRoomData(): void {
    httpTesting
      .expectOne(`${apiUrl}/rooms/12`)
      .flush({
        roomId: 12,
        roomName: 'Shared Flat',
        createdBy: {
          userId: 7,
          name: 'Narayan',
          email: 'narayan@example.com',
        },
        createdAt: '2026-10-21T10:00:00',
        memberCount: 2,
      });
    httpTesting
      .expectOne(`${apiUrl}/rooms/12/expense-categories`)
      .flush([
        { categoryId: 8, categoryName: 'Electricity' },
        { categoryId: 9, categoryName: ' electricity ' },
      ]);
    httpTesting
      .expectOne(`${apiUrl}/rooms/12/members`)
      .flush([
        {
          roomMemberId: 31,
          userId: 7,
          name: 'Narayan',
          email: 'narayan@example.com',
          role: 'ADMIN',
        },
        {
          roomMemberId: 32,
          userId: 8,
          name: 'Rahul',
          email: 'rahul@example.com',
          role: 'MEMBER',
        },
        {
          roomMemberId: 33,
          userId: 8,
          name: 'Rahul',
          email: 'rahul@example.com',
          role: 'MEMBER',
        },
      ]);
  }

  function checkboxEvent(checked: boolean): Event {
    const event = new Event('change');
    Object.defineProperty(event, 'target', {
      value: { checked },
    });
    return event;
  }
});
