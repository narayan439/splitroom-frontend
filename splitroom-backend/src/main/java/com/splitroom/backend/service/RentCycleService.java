package com.splitroom.backend.service;

import com.splitroom.backend.dto.response.ExpenseSummaryResponse;
import com.splitroom.backend.dto.response.RentCycleResponse;
import com.splitroom.backend.dto.response.RentCycleResponse.MemberCycleSummary;
import com.splitroom.backend.entity.Expense;
import com.splitroom.backend.entity.ExpenseShare;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.RentCycle;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.Settlement;
import com.splitroom.backend.repository.ExpenseRepository;
import com.splitroom.backend.repository.ExpenseShareRepository;
import com.splitroom.backend.repository.RentCycleRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.SettlementRepository;
import com.splitroom.backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class RentCycleService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final String RENT_PAYMENT_STATUS_NOT_TRACKED = "NOT_TRACKED";

    private final RoomAuthorizationService roomAuthorizationService;
    private final RoomMemberRepository roomMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpenseShareRepository expenseShareRepository;
    private final RoomRepository roomRepository;
    private final RentCycleRepository rentCycleRepository;
    private final SettlementRepository settlementRepository;

    @Transactional
    public List<RentCycleResponse> getRoomRentCycles(Long roomId) {
        return getRoomRentCycles(roomId, LocalDate.now());
    }

    List<RentCycleResponse> getRoomRentCycles(
            Long roomId,
            LocalDate currentDate
    ) {
        roomAuthorizationService.requireMember(roomId);
        Room room = roomRepository.findByRoomIdForUpdate(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
        List<RoomMember> members =
                roomMemberRepository.findAllByRoomIdWithUser(roomId);
        List<Expense> expenses = expenseRepository.findAllByRoomIdWithDetails(roomId)
                .stream()
                .filter(expense -> !expense.getExpenseDate().isAfter(currentDate))
                .toList();
        List<ExpenseShare> shares =
                expenseShareRepository.findAllDetailsByRoomId(roomId);
        List<Settlement> settlements =
                settlementRepository.findCompletedDetailsByRoomIdThroughDate(
                        roomId,
                        currentDate
                );

        Map<Long, List<ExpenseShare>> sharesByExpense = new LinkedHashMap<>();
        for (ExpenseShare share : shares) {
            sharesByExpense
                    .computeIfAbsent(
                            share.getExpense().getExpenseId(),
                            ignored -> new ArrayList<>()
                    )
                    .add(share);
        }

        YearMonth currentCycle = YearMonth.from(cycleStartFor(currentDate));
        YearMonth firstCycle = Stream.concat(
                        expenses.stream().map(Expense::getExpenseDate),
                        settlements.stream().map(Settlement::getSettlementDate)
                )
                .map(RentCycleService::cycleStartFor)
                .map(YearMonth::from)
                .min(Comparator.naturalOrder())
                .orElse(currentCycle);
        List<RentCycle> persistedCycles =
                rentCycleRepository.findAllByRoom_RoomIdOrderByStartDateDesc(roomId);
        YearMonth oldestPersistedCycle = persistedCycles.stream()
                .filter(cycle -> !cycle.getStartDate().isAfter(currentDate))
                .map(cycle -> YearMonth.from(cycle.getStartDate()))
                .min(Comparator.naturalOrder())
                .orElse(currentCycle);
        if (oldestPersistedCycle.isBefore(firstCycle)) {
            firstCycle = oldestPersistedCycle;
        }
        if (firstCycle.isAfter(currentCycle)) {
            firstCycle = currentCycle;
        }

        Map<YearMonth, CycleAccumulator> cycles = new LinkedHashMap<>();
        for (YearMonth month = firstCycle; !month.isAfter(currentCycle);
             month = month.plusMonths(1)) {
            cycles.put(month, new CycleAccumulator(month, members, month.equals(currentCycle)));
        }

        Set<LocalDate> persistedStarts = new HashSet<>();
        for (RentCycle cycle : persistedCycles) {
            if (cycle.getStartDate().isAfter(currentDate)) {
                continue;
            }
            YearMonth month = YearMonth.from(cycle.getStartDate());
            persistedStarts.add(cycle.getStartDate());
            cycles.computeIfAbsent(
                    month,
                    ignored -> new CycleAccumulator(
                            month,
                            members,
                            month.equals(currentCycle)
                    )
            );
        }

        List<RentCycle> newCycles = new ArrayList<>();
        for (YearMonth month = firstCycle; !month.isAfter(currentCycle);
             month = month.plusMonths(1)) {
            LocalDate startDate = month.atDay(7);
            if (!persistedStarts.contains(startDate)) {
                RentCycle cycle = new RentCycle();
                cycle.setRoom(room);
                cycle.setStartDate(startDate);
                cycle.setEndDate(month.plusMonths(1).atDay(6));
                newCycles.add(cycle);
            }
        }
        if (!newCycles.isEmpty()) {
            rentCycleRepository.saveAll(newCycles);
        }

        for (Expense expense : expenses) {
            YearMonth cycleMonth =
                    YearMonth.from(cycleStartFor(expense.getExpenseDate()));
            CycleAccumulator cycle = cycles.get(cycleMonth);
            List<ExpenseShare> expenseShares = sharesByExpense.getOrDefault(
                    expense.getExpenseId(),
                    List.of()
            );
            cycle.addExpense(expense, expenseShares);
        }

        for (Settlement settlement : settlements) {
            YearMonth cycleMonth =
                    YearMonth.from(cycleStartFor(settlement.getSettlementDate()));
            CycleAccumulator cycle = cycles.get(cycleMonth);
            if (cycle != null) {
                cycle.addSettlement(settlement);
            }
        }

        return cycles.values().stream()
                .sorted(Comparator.comparing(CycleAccumulator::month).reversed())
                .map(CycleAccumulator::toResponse)
                .toList();
    }

    static LocalDate cycleStartFor(LocalDate date) {
        YearMonth month = YearMonth.from(date);
        if (date.getDayOfMonth() < 7) {
            month = month.minusMonths(1);
        }
        return month.atDay(7);
    }

    private static final class CycleAccumulator {
        private final YearMonth month;
        private final boolean currentCycle;
        private final Map<Long, MemberAccumulator> members = new LinkedHashMap<>();
        private final List<ExpenseSummaryResponse> expenses = new ArrayList<>();
        private BigDecimal rentAmount = ZERO;
        private BigDecimal expenseTotal = ZERO;

        private CycleAccumulator(
                YearMonth month,
                List<RoomMember> roomMembers,
                boolean currentCycle
        ) {
            this.month = month;
            this.currentCycle = currentCycle;
            for (RoomMember member : roomMembers) {
                members.put(
                        member.getRoomMemberId(),
                        new MemberAccumulator(
                                member.getRoomMemberId(),
                                member.getUser().getName()
                        )
                );
            }
        }

        private void addSettlement(Settlement settlement) {
            MemberAccumulator sender = getOrAddMember(settlement.getFromMember());
            sender.completedSettlementsSent =
                    sender.completedSettlementsSent.add(settlement.getAmount());
            MemberAccumulator receiver = getOrAddMember(settlement.getToMember());
            receiver.completedSettlementsReceived =
                    receiver.completedSettlementsReceived.add(settlement.getAmount());
        }

        private void addExpense(Expense expense, List<ExpenseShare> shares) {
            expenseTotal = expenseTotal.add(expense.getAmount());
            String categoryName = expense.getCategory().getCategoryName();
            if (isRentCategory(categoryName)) {
                rentAmount = rentAmount.add(expense.getAmount());
            }

            if (expense.getPaidBy() != null) {
                MemberAccumulator payer = getOrAddMember(expense.getPaidBy());
                payer.paidAmount = payer.paidAmount.add(expense.getAmount());
            }
            for (ExpenseShare share : shares) {
                MemberAccumulator participant =
                        getOrAddMember(share.getRoomMember());
                participant.shareAmount =
                        participant.shareAmount.add(share.getShareAmount());
            }

            expenses.add(new ExpenseSummaryResponse(
                    expense.getExpenseId(),
                    expense.getTitle(),
                    expense.getAmount(),
                    expense.getExpenseDate(),
                    categoryName,
                    expense.getPaidBy() == null
                            ? "No one"
                            : expense.getPaidBy().getUser().getName(),
                    shares.size()
            ));
        }

        private RentCycleResponse toResponse() {
            List<MemberCycleSummary> memberSummaries = members.values().stream()
                    .map(MemberAccumulator::toResponse)
                    .toList();
            return new RentCycleResponse(
                    month.atDay(7),
                    month.plusMonths(1).atDay(6),
                    currentCycle,
                    rentAmount,
                    expenseTotal,
                    RENT_PAYMENT_STATUS_NOT_TRACKED,
                    List.copyOf(expenses),
                    memberSummaries
            );
        }

        private YearMonth month() {
            return month;
        }

        private MemberAccumulator getOrAddMember(RoomMember member) {
            return members.computeIfAbsent(
                    member.getRoomMemberId(),
                    ignored -> new MemberAccumulator(
                            member.getRoomMemberId(),
                            member.getUser().getName()
                    )
            );
        }
    }

    private static boolean isRentCategory(String categoryName) {
        return categoryName.equalsIgnoreCase("rent")
                || categoryName.equalsIgnoreCase("room rent");
    }

    private static final class MemberAccumulator {
        private final Long memberId;
        private final String memberName;
        private BigDecimal shareAmount = ZERO;
        private BigDecimal paidAmount = ZERO;
        private BigDecimal completedSettlementsSent = ZERO;
        private BigDecimal completedSettlementsReceived = ZERO;

        private MemberAccumulator(Long memberId, String memberName) {
            this.memberId = memberId;
            this.memberName = memberName;
        }

        private MemberCycleSummary toResponse() {
            return new MemberCycleSummary(
                    memberId,
                    memberName,
                    shareAmount,
                    paidAmount,
                    paidAmount.subtract(shareAmount)
                            .add(completedSettlementsSent)
                            .subtract(completedSettlementsReceived),
                    completedSettlementsSent,
                    completedSettlementsReceived
            );
        }
    }
}
