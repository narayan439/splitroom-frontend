import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateInvitationRequest,
  CreateExpenseRequest,
  CreatedExpense,
  CreateRoomRequest,
  CreateSettlementRequest,
  ExpenseCategory,
  RoomExpense,
  RentCycleSummary,
  RentCycleMemberPaymentStatus,
  RentCycleMemberStatus,
  AdminTransferResponse,
  InvitationStatus,
  MemberBalance,
  MessageResponse,
  RoomDetails,
  RoomInvitation,
  RoomMember,
  RoommateAbsence,
  RoomSettlement,
  MarkAbsentRequest,
  MarkReturnedRequest,
  UpdateAbsenceRulesRequest,
  SettlementStatus,
  SettlementSuggestions,
} from './room.models';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl.replace(/\/+$/, '')}/api`;

  getMyRooms(): Observable<RoomDetails[]> {
    return this.http
      .get<RoomDetails[]>(`${this.apiUrl}/rooms/my`)
      .pipe(timeout({ first: 15_000 }));
  }

  getRoom(roomId: number): Observable<RoomDetails> {
    return this.http.get<RoomDetails>(`${this.apiUrl}/rooms/${roomId}`);
  }

  getMembers(roomId: number): Observable<RoomMember[]> {
    return this.http.get<RoomMember[]>(
      `${this.apiUrl}/rooms/${roomId}/members`
    );
  }

  getAbsenceHistory(
    roomId: number,
    memberId: number
  ): Observable<RoommateAbsence[]> {
    return this.http.get<RoommateAbsence[]>(
      `${this.apiUrl}/rooms/${roomId}/members/${memberId}/absences`
    );
  }

  markAbsent(
    roomId: number,
    memberId: number,
    request: MarkAbsentRequest
  ): Observable<RoommateAbsence> {
    return this.http.post<RoommateAbsence>(
      `${this.apiUrl}/rooms/${roomId}/members/${memberId}/absences`,
      request
    );
  }

  markReturned(
    roomId: number,
    memberId: number,
    absenceId: number,
    request: MarkReturnedRequest
  ): Observable<RoommateAbsence> {
    return this.http.put<RoommateAbsence>(
      `${this.apiUrl}/rooms/${roomId}/members/${memberId}/absences/${absenceId}/return`,
      request
    );
  }

  updateAbsenceRules(
    roomId: number,
    memberId: number,
    absenceId: number,
    request: UpdateAbsenceRulesRequest
  ): Observable<RoommateAbsence> {
    return this.http.put<RoommateAbsence>(
      `${this.apiUrl}/rooms/${roomId}/members/${memberId}/absences/${absenceId}/rules`,
      request
    );
  }

  getExpenseCategories(roomId: number): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(
      `${this.apiUrl}/rooms/${roomId}/expense-categories`
    );
  }

  getRoomExpenses(roomId: number): Observable<RoomExpense[]> {
    return this.http.get<RoomExpense[]>(
      `${this.apiUrl}/rooms/${roomId}/expenses`
    );
  }

  getRoomRentCycles(roomId: number): Observable<RentCycleSummary[]> {
    return this.http.get<RentCycleSummary[]>(
      `${this.apiUrl}/rooms/${roomId}/rent-cycles`
    );
  }

  getRentCycleMemberStatuses(
    roomId: number,
    startDate: string
  ): Observable<RentCycleMemberStatus[]> {
    return this.http.get<RentCycleMemberStatus[]>(
      `${this.apiUrl}/rooms/${roomId}/rent-cycles/${startDate}/member-statuses`
    );
  }

  updateRentCycleMemberStatus(
    roomId: number,
    startDate: string,
    memberId: number,
    status: RentCycleMemberPaymentStatus
  ): Observable<RentCycleMemberStatus> {
    return this.http.put<RentCycleMemberStatus>(
      `${this.apiUrl}/rooms/${roomId}/rent-cycles/${startDate}/members/${memberId}/status`,
      { status }
    );
  }

  getExpenseDetails(
    roomId: number,
    expenseId: number
  ): Observable<CreatedExpense> {
    return this.http.get<CreatedExpense>(
      `${this.apiUrl}/rooms/${roomId}/expenses/${expenseId}`
    );
  }

  createExpense(
    roomId: number,
    request: CreateExpenseRequest
  ): Observable<CreatedExpense> {
    return this.http.post<CreatedExpense>(
      `${this.apiUrl}/rooms/${roomId}/expenses`,
      request
    );
  }

  updateExpense(
    roomId: number,
    expenseId: number,
    request: CreateExpenseRequest
  ): Observable<CreatedExpense> {
    return this.http.put<CreatedExpense>(
      `${this.apiUrl}/rooms/${roomId}/expenses/${expenseId}`,
      request
    );
  }

  createRoom(request: CreateRoomRequest): Observable<RoomDetails> {
    return this.http
      .post<RoomDetails>(`${this.apiUrl}/rooms`, request)
      .pipe(timeout({ first: 20_000 }));
  }

  removeMember(roomId: number, userId: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(
      `${this.apiUrl}/rooms/${roomId}/members/${userId}`
    );
  }

  transferAdmin(
    roomId: number,
    newAdminUserId: number
  ): Observable<AdminTransferResponse> {
    return this.http.put<AdminTransferResponse>(
      `${this.apiUrl}/rooms/${roomId}/admin/${newAdminUserId}`,
      {}
    );
  }

  createInvitation(
    roomId: number,
    request: CreateInvitationRequest
  ): Observable<RoomInvitation> {
    return this.http.post<RoomInvitation>(
      `${this.apiUrl}/rooms/${roomId}/invitations`,
      request
    );
  }

  getRoomInvitations(
    roomId: number,
    status?: InvitationStatus
  ): Observable<RoomInvitation[]> {
    const url = `${this.apiUrl}/rooms/${roomId}/invitations`;
    return this.http.get<RoomInvitation[]>(
      status ? `${url}?status=${status}` : url
    );
  }

  getMyInvitations(): Observable<RoomInvitation[]> {
    return this.http.get<RoomInvitation[]>(
      `${this.apiUrl}/users/me/invitations`
    );
  }

  acceptInvitation(invitationId: number): Observable<RoomInvitation> {
    return this.http.put<RoomInvitation>(
      `${this.apiUrl}/invitations/${invitationId}/accept`,
      {}
    );
  }

  declineInvitation(invitationId: number): Observable<RoomInvitation> {
    return this.http.put<RoomInvitation>(
      `${this.apiUrl}/invitations/${invitationId}/decline`,
      {}
    );
  }

  cancelInvitation(invitationId: number): Observable<RoomInvitation> {
    return this.http.put<RoomInvitation>(
      `${this.apiUrl}/invitations/${invitationId}/cancel`,
      {}
    );
  }

  getRoomBalances(roomId: number): Observable<MemberBalance[]> {
    return this.http.get<MemberBalance[]>(
      `${this.apiUrl}/rooms/${roomId}/balances`
    );
  }

  getSettlementSuggestions(
    roomId: number
  ): Observable<SettlementSuggestions> {
    return this.http.get<SettlementSuggestions>(
      `${this.apiUrl}/rooms/${roomId}/settlement-suggestions`
    );
  }

  getSettlements(
    roomId: number,
    status?: SettlementStatus
  ): Observable<RoomSettlement[]> {
    const url = `${this.apiUrl}/rooms/${roomId}/settlements`;
    return this.http.get<RoomSettlement[]>(
      status ? `${url}?status=${status}` : url
    );
  }

  createSettlement(
    roomId: number,
    request: CreateSettlementRequest
  ): Observable<RoomSettlement> {
    return this.http.post<RoomSettlement>(
      `${this.apiUrl}/rooms/${roomId}/settlements`,
      request
    );
  }

  completeSettlement(
    roomId: number,
    settlementId: number
  ): Observable<RoomSettlement> {
    return this.http.put<RoomSettlement>(
      `${this.apiUrl}/rooms/${roomId}/settlements/${settlementId}/complete`,
      {}
    );
  }

  cancelSettlement(
    roomId: number,
    settlementId: number
  ): Observable<RoomSettlement> {
    return this.http.put<RoomSettlement>(
      `${this.apiUrl}/rooms/${roomId}/settlements/${settlementId}/cancel`,
      {}
    );
  }
}
