package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.ExpenseRequest;
import com.splitroom.backend.dto.response.ExpenseDetailsResponse;
import com.splitroom.backend.dto.response.ExpenseSummaryResponse;
import com.splitroom.backend.entity.AbsenceCategoryRule;
import com.splitroom.backend.entity.AbsenceRuleType;
import com.splitroom.backend.entity.Expense;
import com.splitroom.backend.entity.ExpenseCategory;
import com.splitroom.backend.entity.ExpenseShare;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.RoommateAbsence;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.AbsenceCategoryRuleRepository;
import com.splitroom.backend.repository.ExpenseCategoryRepository;
import com.splitroom.backend.repository.ExpenseRepository;
import com.splitroom.backend.repository.ExpenseShareRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.RoommateAbsenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private static final BigDecimal CENT = new BigDecimal("0.01");

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpenseShareRepository expenseShareRepository;
    private final RoommateAbsenceRepository absenceRepository;
    private final AbsenceCategoryRuleRepository absenceRuleRepository;
    private final RoomAuthorizationService roomAuthorizationService;

    @Transactional
    public ExpenseDetailsResponse createExpense(
            Long roomId,
            ExpenseRequest request
    ) {
        Room room = findRoomForUpdate(roomId);
        RoomMember requester = roomAuthorizationService.requireMember(roomId);
        requireAllowedPayer(requester, request.getPaidByMemberId());
        ExpenseCategory category = findCategory(roomId, request.getCategoryId());
        RoomMember payer = request.getPaidByMemberId() == null
                ? null
                : findMember(roomId, request.getPaidByMemberId());
        List<RoomMember> participants =
                findParticipants(roomId, request.getSplitBetweenMemberIds());
        List<CalculatedShare> shares = calculateShares(
                roomId,
                category.getCategoryId(),
                request.getExpenseDate(),
                participants,
                request.getAmount()
        );

        Expense expense = new Expense();
        expense.setRoom(room);
        applyRequest(expense, request, category, payer);
        Expense savedExpense = expenseRepository.save(expense);

        saveShares(savedExpense, shares);
        return toDetails(savedExpense);
    }

    static void requireAllowedPayer(RoomMember requester, Long payerMemberId) {
        if (payerMemberId != null &&
                requester.getRole() != UserRole.ADMIN
                && !requester.getRoomMemberId().equals(payerMemberId)) {
            throw new ForbiddenException(
                    "Only a room admin may record an expense paid by another member"
            );
        }
    }

    @Transactional(readOnly = true)
    public List<ExpenseSummaryResponse> getExpensesByRoom(Long roomId) {
        roomAuthorizationService.requireMember(roomId);
        findRoom(roomId);
        return expenseRepository
                .findAllByRoom_RoomIdOrderByExpenseDateDescExpenseIdDesc(roomId)
                .stream()
                .map(expense -> new ExpenseSummaryResponse(
                        expense.getExpenseId(),
                        expense.getTitle(),
                        expense.getAmount(),
                        expense.getExpenseDate(),
                        expense.getCategory().getCategoryName(),
                        expense.getPaidBy() == null
                                ? "No one"
                                : expense.getPaidBy().getUser().getName(),
                        expenseShareRepository.countByExpense_ExpenseId(
                                expense.getExpenseId()
                        )
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public ExpenseDetailsResponse getExpenseDetails(
            Long roomId,
            Long expenseId
    ) {
        roomAuthorizationService.requireMember(roomId);
        return toDetails(findExpenseDetails(roomId, expenseId));
    }

    @Transactional
    public ExpenseDetailsResponse updateExpense(
            Long roomId,
            Long expenseId,
            ExpenseRequest request
    ) {
        findRoomForUpdate(roomId);
        RoomMember requesterMembership =
                roomAuthorizationService.requireMember(roomId);
        Expense expense = expenseRepository
                .findByRoomIdAndExpenseIdForUpdate(roomId, expenseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Expense " + expenseId + " not found in room " + roomId
                ));
        requireAdminExpenseEditor(requesterMembership);

        ExpenseCategory category = findCategory(roomId, request.getCategoryId());
        RoomMember payer = request.getPaidByMemberId() == null
                ? null
                : findMember(roomId, request.getPaidByMemberId());
        List<RoomMember> participants =
                findParticipants(roomId, request.getSplitBetweenMemberIds());
        List<CalculatedShare> shares = calculateShares(
                roomId,
                category.getCategoryId(),
                request.getExpenseDate(),
                participants,
                request.getAmount()
        );

        applyRequest(expense, request, category, payer);
        Expense savedExpense = expenseRepository.save(expense);
        saveShares(savedExpense, shares);

        return toDetails(savedExpense);
    }

    @Transactional
    public void deleteExpense(Long roomId, Long expenseId) {
        findRoomForUpdate(roomId);
        RoomMember requesterMembership =
                roomAuthorizationService.requireMember(roomId);
        Expense expense = expenseRepository
                .findByRoomIdAndExpenseIdForUpdate(roomId, expenseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Expense " + expenseId + " not found in room " + roomId
                ));
        requireExpenseEditor(expense, requesterMembership);

        expenseShareRepository.deleteAll(
                expenseShareRepository.findAllByExpense_ExpenseId(expenseId)
        );
        expenseRepository.delete(expense);
    }

    private void requireExpenseEditor(
            Expense expense,
            RoomMember requesterMembership
    ) {
        if (requesterMembership.getRole()
                != com.splitroom.backend.entity.UserRole.ADMIN
                && (expense.getPaidBy() == null
                        || !expense.getPaidBy().getRoomMemberId()
                                .equals(requesterMembership.getRoomMemberId()))) {
            throw new ForbiddenException(
                    "Only the expense payer or a room admin may change this expense"
            );
        }
    }

    static void requireAdminExpenseEditor(RoomMember requesterMembership) {
        if (requesterMembership.getRole()
                != com.splitroom.backend.entity.UserRole.ADMIN) {
            throw new ForbiddenException(
                    "Only a room admin may edit an expense"
            );
        }
    }

    private Room findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
    }

    private Room findRoomForUpdate(Long roomId) {
        return roomRepository.findByRoomIdForUpdate(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
    }

    private ExpenseCategory findCategory(Long roomId, Long categoryId) {
        return expenseCategoryRepository
                .findByCategoryIdAndRoom_RoomId(categoryId, roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Expense category " + categoryId
                                + " not found in room " + roomId
                ));
    }

    private RoomMember findMember(Long roomId, Long roomMemberId) {
        return roomMemberRepository
                .findByRoom_RoomIdAndRoomMemberId(roomId, roomMemberId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room member " + roomMemberId
                                + " not found in room " + roomId
                ));
    }

    private List<RoomMember> findParticipants(
            Long roomId,
            List<Long> participantIds
    ) {
        if (new HashSet<>(participantIds).size() != participantIds.size()) {
            throw new ConflictException(
                    "Split participant IDs must not contain duplicates"
            );
        }

        List<RoomMember> members =
                roomMemberRepository.findAllByRoom_RoomIdAndRoomMemberIdIn(
                        roomId,
                        participantIds
                );
        if (members.size() != participantIds.size()) {
            throw new ResourceNotFoundException(
                    "One or more split participants do not belong to room "
                            + roomId
            );
        }

        Map<Long, RoomMember> membersById = members.stream()
                .collect(Collectors.toMap(
                        RoomMember::getRoomMemberId,
                        Function.identity()
                ));
        return participantIds.stream().map(membersById::get).toList();
    }

    private void applyRequest(
            Expense expense,
            ExpenseRequest request,
            ExpenseCategory category,
            RoomMember payer
    ) {
        expense.setCategory(category);
        expense.setPaidBy(payer);
        expense.setTitle(request.getTitle().trim());
        expense.setAmount(request.getAmount().setScale(2, RoundingMode.UNNECESSARY));
        expense.setExpenseDate(request.getExpenseDate());
    }

    private void saveShares(
            Expense expense,
            List<CalculatedShare> calculatedShares
    ) {
        Map<Long, ExpenseShare> existingByMemberId =
                expenseShareRepository.findAllByExpense_ExpenseId(
                                expense.getExpenseId()
                        )
                        .stream()
                        .collect(Collectors.toMap(
                                share -> share.getRoomMember().getRoomMemberId(),
                                Function.identity()
                        ));
        List<ExpenseShare> sharesToSave =
                new ArrayList<>(calculatedShares.size());
        for (CalculatedShare calculatedShare : calculatedShares) {
            Long memberId = calculatedShare.member().getRoomMemberId();
            ExpenseShare share = existingByMemberId.remove(
                    memberId
            );
            if (share == null) {
                share = new ExpenseShare();
                share.setExpense(expense);
                share.setRoomMember(calculatedShare.member());
            }
            share.setShareAmount(calculatedShare.amount());
            sharesToSave.add(share);
        }

        if (!existingByMemberId.isEmpty()) {
            expenseShareRepository.deleteAll(existingByMemberId.values());
        }
        expenseShareRepository.saveAll(sharesToSave);
    }

    private List<CalculatedShare> calculateShares(
            Long roomId,
            Long categoryId,
            LocalDate expenseDate,
            List<RoomMember> selectedParticipants,
            BigDecimal amount
    ) {
        List<Long> memberIds = selectedParticipants.stream()
                .map(RoomMember::getRoomMemberId)
                .toList();
        List<RoommateAbsence> activeAbsences =
                absenceRepository.findActiveAbsencesForExpenseDate(
                        roomId,
                        memberIds,
                        expenseDate
                );
        Map<Long, RoommateAbsence> absenceByMemberId = activeAbsences.stream()
                .collect(Collectors.toMap(
                        absence -> absence.getRoomMember().getRoomMemberId(),
                        Function.identity()
                ));

        Map<Long, AbsenceRuleType> ruleByAbsenceId = Map.of();
        if (!activeAbsences.isEmpty()) {
            List<Long> absenceIds = activeAbsences.stream()
                    .map(RoommateAbsence::getAbsenceId)
                    .toList();
            ruleByAbsenceId = absenceRuleRepository
                    .findAllWithCategoryByAbsenceIds(absenceIds)
                    .stream()
                    .filter(rule -> rule.getCategory().getCategoryId()
                            .equals(categoryId))
                    .collect(Collectors.toMap(
                            rule -> rule.getAbsence().getAbsenceId(),
                            AbsenceCategoryRule::getRuleType
                    ));
        }

        YearMonth billingMonth = YearMonth.from(expenseDate);
        int billingDays = billingMonth.lengthOfMonth();
        List<WeightedParticipant> eligible = new ArrayList<>();

        for (RoomMember member : selectedParticipants) {
            RoommateAbsence absence =
                    absenceByMemberId.get(member.getRoomMemberId());
            AbsenceRuleType ruleType = absence == null
                    ? AbsenceRuleType.FULL
                    : ruleByAbsenceId.getOrDefault(
                            absence.getAbsenceId(),
                            AbsenceRuleType.FULL
                    );

            if (ruleType == AbsenceRuleType.EXCLUDED) {
                continue;
            }

            int weight = ruleType == AbsenceRuleType.DAILY
                    ? billingDays - absentDaysInMonth(absence, billingMonth)
                    : billingDays;
            if (weight > 0) {
                eligible.add(new WeightedParticipant(member, weight));
            }
        }

        if (eligible.isEmpty()) {
            throw new ConflictException(
                    "At least one eligible participant must remain after applying absence rules"
            );
        }

        List<BigDecimal> amounts = calculateWeightedShares(
                amount,
                eligible.stream().map(WeightedParticipant::weight).toList()
        );
        List<CalculatedShare> shares = new ArrayList<>(eligible.size());
        for (int index = 0; index < eligible.size(); index++) {
            shares.add(new CalculatedShare(
                    eligible.get(index).member(),
                    amounts.get(index)
            ));
        }
        return List.copyOf(shares);
    }

    private int absentDaysInMonth(
            RoommateAbsence absence,
            YearMonth billingMonth
    ) {
        LocalDate monthStart = billingMonth.atDay(1);
        LocalDate monthEnd = billingMonth.atEndOfMonth();
        LocalDate absenceStart = absence.getDepartureDate().isAfter(monthStart)
                ? absence.getDepartureDate()
                : monthStart;

        LocalDate absenceEnd = absence.getReturnDate() == null
                ? monthEnd
                : absence.getReturnDate().minusDays(1);
        if (absenceEnd.isAfter(monthEnd)) {
            absenceEnd = monthEnd;
        }
        if (absenceEnd.isBefore(absenceStart)) {
            return 0;
        }
        return Math.toIntExact(
                java.time.temporal.ChronoUnit.DAYS.between(
                        absenceStart,
                        absenceEnd
                ) + 1
        );
    }

    static List<BigDecimal> calculateWeightedShares(
            BigDecimal amount,
            List<Integer> weights
    ) {
        if (weights.isEmpty() || weights.stream().anyMatch(weight -> weight <= 0)) {
            throw new IllegalArgumentException(
                    "Participants must have positive split weights"
            );
        }
        BigInteger totalCents = amount
                .setScale(2, RoundingMode.UNNECESSARY)
                .movePointRight(2)
                .toBigIntegerExact();
        int totalWeight = weights.stream()
                .mapToInt(Integer::intValue)
                .sum();

        List<ShareRemainder> calculated = new ArrayList<>(weights.size());
        BigInteger weightTotal = BigInteger.valueOf(totalWeight);
        BigInteger assignedCents = BigInteger.ZERO;
        for (int index = 0; index < weights.size(); index++) {
            BigInteger weightedCents = totalCents.multiply(
                    BigInteger.valueOf(weights.get(index))
            );
            BigInteger[] quotientAndRemainder =
                    weightedCents.divideAndRemainder(weightTotal);
            calculated.add(new ShareRemainder(
                    index,
                    quotientAndRemainder[0],
                    quotientAndRemainder[1]
            ));
            assignedCents = assignedCents.add(quotientAndRemainder[0]);
        }

        int remainingCents = totalCents.subtract(assignedCents).intValueExact();
        List<Integer> remainderOrder = calculated.stream()
                .sorted(Comparator
                        .comparing(ShareRemainder::remainder).reversed()
                        .thenComparingInt(ShareRemainder::index))
                .limit(remainingCents)
                .map(ShareRemainder::index)
                .toList();
        Set<Integer> receivesRemainder = new HashSet<>(remainderOrder);

        return calculated.stream()
                .sorted(Comparator.comparingInt(ShareRemainder::index))
                .map(share -> {
                    BigInteger cents = receivesRemainder.contains(share.index())
                            ? share.baseCents().add(BigInteger.ONE)
                            : share.baseCents();
                    return new BigDecimal(cents, 2);
                })
                .toList();
    }

    private record WeightedParticipant(
            RoomMember member,
            int weight
    ) {
    }

    private record ShareRemainder(
            int index,
            BigInteger baseCents,
            BigInteger remainder
    ) {
    }

    private record CalculatedShare(RoomMember member, BigDecimal amount) {
    }

    static List<BigDecimal> calculateEqualShares(
            BigDecimal amount,
            int participantCount
    ) {
        if (participantCount <= 0) {
            throw new IllegalArgumentException(
                    "At least one participant is required"
            );
        }

        BigInteger totalCents = amount
                .setScale(2, RoundingMode.UNNECESSARY)
                .movePointRight(2)
                .toBigIntegerExact();
        BigInteger[] quotientAndRemainder = totalCents.divideAndRemainder(
                BigInteger.valueOf(participantCount)
        );
        BigDecimal baseShare = new BigDecimal(quotientAndRemainder[0], 2);
        int remainderCents = quotientAndRemainder[1].intValueExact();

        List<BigDecimal> shares = new ArrayList<>(participantCount);
        for (int index = 0; index < participantCount; index++) {
            shares.add(index < remainderCents
                    ? baseShare.add(CENT)
                    : baseShare);
        }
        return List.copyOf(shares);
    }

    private Expense findExpenseDetails(Long roomId, Long expenseId) {
        return expenseRepository.findDetailsByRoomIdAndExpenseId(roomId, expenseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Expense " + expenseId + " not found in room " + roomId
                ));
    }

    private ExpenseDetailsResponse toDetails(Expense expense) {
        RoomMember payer = expense.getPaidBy();
        List<ExpenseDetailsResponse.ParticipantShare> participants =
                expenseShareRepository.findDetailsByExpenseId(
                                expense.getExpenseId()
                        )
                        .stream()
                        .map(share -> {
                            RoomMember member = share.getRoomMember();
                            return new ExpenseDetailsResponse.ParticipantShare(
                                    member.getRoomMemberId(),
                                    member.getUser().getUserId(),
                                    member.getUser().getName(),
                                    member.getUser().getEmail(),
                                    share.getShareAmount()
                            );
                        })
                        .toList();

        return new ExpenseDetailsResponse(
                expense.getExpenseId(),
                expense.getTitle(),
                expense.getAmount(),
                expense.getExpenseDate(),
                expense.getCreatedAt(),
                new ExpenseDetailsResponse.CategoryDetails(
                        expense.getCategory().getCategoryId(),
                        expense.getCategory().getCategoryName()
                ),
                payer == null ? null : new ExpenseDetailsResponse.MemberDetails(
                        payer.getRoomMemberId(),
                        payer.getUser().getUserId(),
                        payer.getUser().getName(),
                        payer.getUser().getEmail()
                ),
                participants
        );
    }
}
