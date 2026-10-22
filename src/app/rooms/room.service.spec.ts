import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { RoomService } from './room.service';

describe('RoomService', () => {
  let service: RoomService;
  let httpTesting: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/api`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        RoomService,
      ],
    });
    service = TestBed.inject(RoomService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends an email invitation to the existing room invitation endpoint', () => {
    service
      .createInvitation(14, { invitedUserEmail: 'person@example.com' })
      .subscribe();

    const request = httpTesting.expectOne(
      `${apiUrl}/rooms/14/invitations`
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      invitedUserEmail: 'person@example.com',
    });
    request.flush({});
  });

  it('loads balances, server-calculated suggestions, and settlement history', () => {
    service.getRoomBalances(14).subscribe();
    service.getSettlementSuggestions(14).subscribe();
    service.getSettlements(14, 'PENDING').subscribe();

    const balances = httpTesting.expectOne(`${apiUrl}/rooms/14/balances`);
    const suggestions = httpTesting.expectOne(
      `${apiUrl}/rooms/14/settlement-suggestions`
    );
    const settlements = httpTesting.expectOne(
      `${apiUrl}/rooms/14/settlements?status=PENDING`
    );
    expect(balances.request.method).toBe('GET');
    expect(suggestions.request.method).toBe('GET');
    expect(settlements.request.method).toBe('GET');
    balances.flush([]);
    suggestions.flush({ roomId: 14, roomName: 'Shared Flat', suggestions: [] });
    settlements.flush([]);
  });

  it('loads room categories and expenses and creates expenses with the backend DTO', () => {
    service.getExpenseCategories(14).subscribe();
    service.getRoomExpenses(14).subscribe();
    service
      .createExpense(14, {
        categoryId: 3,
        paidByMemberId: 8,
        title: 'Vegetables',
        amount: 325.5,
        expenseDate: '2026-10-21',
        splitBetweenMemberIds: [8, 9],
      })
      .subscribe();

    const categories = httpTesting.expectOne(
      `${apiUrl}/rooms/14/expense-categories`
    );
    const expenses = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/rooms/14/expenses` &&
        request.method === 'GET'
    );
    const create = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/rooms/14/expenses` &&
        request.method === 'POST'
    );
    expect(categories.request.method).toBe('GET');
    expect(expenses.request.method).toBe('GET');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      categoryId: 3,
      paidByMemberId: 8,
      title: 'Vegetables',
      amount: 325.5,
      expenseDate: '2026-10-21',
      splitBetweenMemberIds: [8, 9],
    });
    categories.flush([]);
    expenses.flush([]);
    create.flush({});
  });

  it('loads the room-scoped rent cycle history', () => {
    service.getRoomRentCycles(14).subscribe();

    const request = httpTesting.expectOne(
      `${apiUrl}/rooms/14/rent-cycles`
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('loads and updates cycle-specific member payment statuses', () => {
    service.getRentCycleMemberStatuses(14, '2026-10-07').subscribe();
    service
      .updateRentCycleMemberStatus(14, '2026-10-07', 6, 'CLEAR')
      .subscribe();

    const statuses = httpTesting.expectOne(
      `${apiUrl}/rooms/14/rent-cycles/2026-10-07/member-statuses`
    );
    const update = httpTesting.expectOne(
      `${apiUrl}/rooms/14/rent-cycles/2026-10-07/members/6/status`
    );
    expect(statuses.request.method).toBe('GET');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ status: 'CLEAR' });
    statuses.flush([{ memberId: 6, status: 'PENDING' }]);
    update.flush({ memberId: 6, status: 'CLEAR' });
  });

  it('loads expense details and updates an expense using its room-scoped endpoint', () => {
    const request = {
      categoryId: 3,
      paidByMemberId: 8,
      title: 'Updated vegetables',
      amount: 400,
      expenseDate: '2026-10-22',
      splitBetweenMemberIds: [8, 9],
    };
    service.getExpenseDetails(14, 27).subscribe();
    service.updateExpense(14, 27, request).subscribe();

    const details = httpTesting.expectOne(
      (httpRequest) =>
        httpRequest.url === `${apiUrl}/rooms/14/expenses/27` &&
        httpRequest.method === 'GET'
    );
    const update = httpTesting.expectOne(
      (httpRequest) =>
        httpRequest.url === `${apiUrl}/rooms/14/expenses/27` &&
        httpRequest.method === 'PUT'
    );
    expect(details.request.method).toBe('GET');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(request);
    details.flush({});
    update.flush({});
  });

  it('uses the existing room absence history, return, and rule endpoints', () => {
    service.getAbsenceHistory(14, 8).subscribe();
    service
      .markAbsent(14, 8, {
        departureDate: '2026-10-21',
        reason: 'Travel',
      })
      .subscribe();
    service
      .markReturned(14, 8, 27, { returnDate: '2026-10-25' })
      .subscribe();
    service
      .updateAbsenceRules(14, 8, 27, {
        rules: [
          { categoryId: 3, ruleType: 'FULL' },
          { categoryId: 4, ruleType: 'DAILY' },
          { categoryId: 5, ruleType: 'EXCLUDED' },
        ],
      })
      .subscribe();

    const history = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/rooms/14/members/8/absences` &&
        request.method === 'GET'
    );
    const absent = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/rooms/14/members/8/absences` &&
        request.method === 'POST'
    );
    const returned = httpTesting.expectOne(
      `${apiUrl}/rooms/14/members/8/absences/27/return`
    );
    const rules = httpTesting.expectOne(
      `${apiUrl}/rooms/14/members/8/absences/27/rules`
    );
    expect(history.request.method).toBe('GET');
    expect(absent.request.method).toBe('POST');
    expect(absent.request.body).toEqual({
      departureDate: '2026-10-21',
      reason: 'Travel',
    });
    expect(returned.request.method).toBe('PUT');
    expect(returned.request.body).toEqual({ returnDate: '2026-10-25' });
    expect(rules.request.method).toBe('PUT');
    expect(rules.request.body.rules.map(
      (rule: { ruleType: string }) => rule.ruleType
    )).toEqual(['FULL', 'DAILY', 'EXCLUDED']);
    history.flush([]);
    absent.flush({});
    returned.flush({});
    rules.flush({});
  });

  it('records, completes, and cancels settlements using the room endpoints', () => {
    service
      .createSettlement(14, {
        fromMemberId: 6,
        toMemberId: 9,
        amount: 125.5,
        settlementDate: '2026-10-21',
      })
      .subscribe();
    service.completeSettlement(14, 25).subscribe();
    service.cancelSettlement(14, 26).subscribe();

    const create = httpTesting.expectOne(`${apiUrl}/rooms/14/settlements`);
    const complete = httpTesting.expectOne(
      `${apiUrl}/rooms/14/settlements/25/complete`
    );
    const cancel = httpTesting.expectOne(
      `${apiUrl}/rooms/14/settlements/26/cancel`
    );
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      fromMemberId: 6,
      toMemberId: 9,
      amount: 125.5,
      settlementDate: '2026-10-21',
    });
    expect(complete.request.method).toBe('PUT');
    expect(cancel.request.method).toBe('PUT');
    create.flush({});
    complete.flush({});
    cancel.flush({});
  });
});
