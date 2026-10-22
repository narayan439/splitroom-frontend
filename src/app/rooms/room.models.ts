export interface RoomDetails {
  roomId: number;
  roomName: string;
  createdBy: {
    userId: number;
    name: string;
    email: string;
  };
  createdAt: string;
  memberCount: number;
}

export interface RoomMember {
  roomMemberId: number;
  userId: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export type AbsenceRuleType = 'FULL' | 'DAILY' | 'EXCLUDED';

export interface AbsenceCategoryRule {
  categoryId: number;
  categoryName: string;
  ruleType: AbsenceRuleType;
}

export interface RoommateAbsence {
  absenceId: number;
  memberId: number;
  memberName: string;
  departureDate: string;
  returnDate: string | null;
  reason: string | null;
  status: 'ACTIVE' | 'RETURNED';
  rules: AbsenceCategoryRule[];
}

export interface MarkAbsentRequest {
  departureDate: string;
  reason: string | null;
}

export interface MarkReturnedRequest {
  returnDate: string;
}

export interface UpdateAbsenceRulesRequest {
  rules: {
    categoryId: number;
    ruleType: AbsenceRuleType;
  }[];
}

export interface ExpenseCategory {
  categoryId: number;
  categoryName: string;
}

export interface CreateExpenseRequest {
  categoryId: number;
  paidByMemberId: number | null;
  title: string;
  amount: number;
  expenseDate: string;
  splitBetweenMemberIds: number[];
}

export interface RoomExpense {
  expenseId: number;
  title: string;
  amount: number;
  expenseDate: string;
  categoryName: string;
  payerName: string;
  participantCount: number;
}

export interface RentCycleMemberSummary {
  memberId: number;
  memberName: string;
  shareAmount: number;
  paidAmount: number;
  netBalance: number;
  completedSettlementsSent: number;
  completedSettlementsReceived: number;
}

export interface RentCycleSummary {
  startDate: string;
  endDate: string;
  currentCycle: boolean;
  rentAmount: number;
  expenseTotal: number;
  rentPaymentStatus: 'NOT_TRACKED';
  expenses: RoomExpense[];
  members: RentCycleMemberSummary[];
}

export type RentCycleMemberPaymentStatus = 'PENDING' | 'CLEAR';

export interface RentCycleMemberStatus {
  memberId: number;
  status: RentCycleMemberPaymentStatus;
}

export interface CreatedExpense {
  expenseId: number;
  title: string;
  amount: number;
  expenseDate: string;
  createdAt: string;
  category: {
    categoryId: number;
    categoryName: string;
  };
  paidBy: {
    roomMemberId: number;
    userId: number;
    name: string;
    email: string;
  } | null;
  participants: {
    roomMemberId: number;
    userId: number;
    name: string;
    email: string;
    shareAmount: number;
  }[];
}

export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED';

export interface RoomInvitation {
  invitationId: number;
  roomId: number;
  roomName: string;
  invitedUserId: number;
  invitedUserName: string;
  invitedUserEmail: string;
  invitedByMemberId: number;
  invitedByUserId: number;
  invitedByName: string;
  status: InvitationStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface CreateRoomRequest {
  roomName: string;
}

export interface CreateInvitationRequest {
  invitedUserEmail: string;
}

export interface MemberBalance {
  roomId: number;
  roomName: string;
  memberId: number;
  memberName: string;
  totalPaid: number;
  totalShare: number;
  netBalance: number;
}

export interface SettlementSuggestion {
  fromMemberId: number;
  fromMemberName: string;
  toMemberId: number;
  toMemberName: string;
  amount: number;
}

export interface SettlementSuggestions {
  roomId: number;
  roomName: string;
  suggestions: SettlementSuggestion[];
}

export type SettlementStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface SettlementMember {
  memberId: number;
  userId: number;
  name: string;
}

export interface RoomSettlement {
  settlementId: number;
  roomId: number;
  fromMember: SettlementMember;
  toMember: SettlementMember;
  amount: number;
  settlementDate: string;
  status: SettlementStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateSettlementRequest {
  fromMemberId: number;
  toMemberId: number;
  amount: number;
  settlementDate: string;
}

export interface MessageResponse {
  message: string;
}

export interface AdminTransferResponse {
  roomId: number;
  previousAdminUserId: number | null;
  newAdminUserId: number;
  message: string;
}
