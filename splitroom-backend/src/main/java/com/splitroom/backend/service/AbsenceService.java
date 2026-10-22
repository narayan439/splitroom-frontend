package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.AbsenceRulesRequest;
import com.splitroom.backend.dto.request.MarkAbsentRequest;
import com.splitroom.backend.dto.response.RoommateAbsenceResponse;
import com.splitroom.backend.dto.response.RoommateAbsenceResponse.CategoryRule;
import com.splitroom.backend.entity.AbsenceCategoryRule;
import com.splitroom.backend.entity.ExpenseCategory;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.RoommateAbsence;
import com.splitroom.backend.entity.AbsenceRuleType;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.AbsenceCategoryRuleRepository;
import com.splitroom.backend.repository.ExpenseCategoryRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.RoommateAbsenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AbsenceService {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoommateAbsenceRepository absenceRepository;
    private final AbsenceCategoryRuleRepository ruleRepository;
    private final ExpenseCategoryRepository categoryRepository;
    private final RoomAuthorizationService roomAuthorizationService;

    @Transactional
    public RoommateAbsenceResponse markAbsent(
            Long roomId,
            Long memberId,
            MarkAbsentRequest request
    ) {
        Room room = findRoomForUpdate(roomId);
        roomAuthorizationService.requireAdmin(roomId);
        RoomMember member = findMember(roomId, memberId);

        if (absenceRepository.existsOverlappingAbsence(
                memberId,
                request.getDepartureDate()
        )) {
            throw new ConflictException(
                    "This absence overlaps an existing absence period"
            );
        }

        RoommateAbsence absence = new RoommateAbsence();
        absence.setRoomMember(member);
        absence.setDepartureDate(request.getDepartureDate());
        absence.setReason(request.getReason() == null
                ? null
                : request.getReason().trim());
        return toResponse(absenceRepository.save(absence), List.of());
    }

    @Transactional
    public RoommateAbsenceResponse markReturned(
            Long roomId,
            Long memberId,
            Long absenceId,
            LocalDate returnDate
    ) {
        findRoomForUpdate(roomId);
        roomAuthorizationService.requireAdmin(roomId);
        RoommateAbsence absence = findAbsence(roomId, memberId, absenceId);

        if (absence.getReturnDate() != null) {
            throw new ConflictException(
                    "This absence has already been closed"
            );
        }
        if (returnDate.isBefore(absence.getDepartureDate())) {
            throw new ConflictException(
                    "Return date cannot be earlier than the departure date"
            );
        }

        absence.setReturnDate(returnDate);
        RoommateAbsence savedAbsence = absenceRepository.save(absence);
        return toResponse(savedAbsence, getRules(List.of(absenceId)));
    }

    @Transactional(readOnly = true)
    public List<RoommateAbsenceResponse> getAbsenceHistory(
            Long roomId,
            Long memberId
    ) {
        roomAuthorizationService.requireMember(roomId);
        findRoom(roomId);
        findMember(roomId, memberId);
        List<RoommateAbsence> absences =
                absenceRepository.findHistoryByRoomAndMember(roomId, memberId);
        if (absences.isEmpty()) {
            return List.of();
        }

        Map<Long, List<AbsenceCategoryRule>> rulesByAbsenceId =
                getRules(absences.stream()
                        .map(RoommateAbsence::getAbsenceId)
                        .toList())
                        .stream()
                        .collect(Collectors.groupingBy(
                                rule -> rule.getAbsence().getAbsenceId()
                        ));

        return absences.stream()
                .map(absence -> toResponse(
                        absence,
                        rulesByAbsenceId.getOrDefault(
                                absence.getAbsenceId(),
                                List.of()
                        )
                ))
                .toList();
    }

    @Transactional
    public RoommateAbsenceResponse updateRules(
            Long roomId,
            Long memberId,
            Long absenceId,
            AbsenceRulesRequest request
    ) {
        findRoomForUpdate(roomId);
        roomAuthorizationService.requireAdmin(roomId);
        RoommateAbsence absence = findAbsence(roomId, memberId, absenceId);
        List<AbsenceRulesRequest.RuleRequest> requestedRules = request.getRules();
        List<Long> categoryIds = requestedRules.stream()
                .map(AbsenceRulesRequest.RuleRequest::getCategoryId)
                .toList();

        if (new HashSet<>(categoryIds).size() != categoryIds.size()) {
            throw new ConflictException(
                    "Category IDs must not be duplicated in the rules"
            );
        }

        List<ExpenseCategory> categories = categoryIds.isEmpty()
                ? List.of()
                : categoryRepository.findAllByCategoryIdInAndRoom_RoomId(
                        categoryIds,
                        roomId
                );
        if (categories.size() != categoryIds.size()) {
            throw new ResourceNotFoundException(
                    "One or more expense categories do not belong to room "
                            + roomId
            );
        }

        Map<Long, ExpenseCategory> categoryById = categories.stream()
                .collect(Collectors.toMap(
                        ExpenseCategory::getCategoryId,
                        Function.identity()
                ));
        List<AbsenceCategoryRule> existingRules =
                ruleRepository.findAllByAbsence_AbsenceId(absenceId);
        Map<Long, AbsenceCategoryRule> existingByCategoryId =
                existingRules.stream()
                        .collect(Collectors.toMap(
                                rule -> rule.getCategory().getCategoryId(),
                                Function.identity()
                        ));

        List<AbsenceCategoryRule> rulesToSave =
                new ArrayList<>(requestedRules.size());
        for (AbsenceRulesRequest.RuleRequest requested : requestedRules) {
            Long categoryId = requested.getCategoryId();
            AbsenceCategoryRule rule = existingByCategoryId.remove(categoryId);
            if (rule == null) {
                rule = new AbsenceCategoryRule();
                rule.setAbsence(absence);
                rule.setCategory(categoryById.get(categoryId));
            }
            rule.setRuleType(requested.getRuleType());
            rulesToSave.add(rule);
        }

        if (!existingByCategoryId.isEmpty()) {
            ruleRepository.deleteAll(existingByCategoryId.values());
        }
        ruleRepository.saveAll(rulesToSave);

        return toResponse(
                absence,
                ruleRepository.findAllByAbsence_AbsenceId(absenceId)
        );
    }

    private List<AbsenceCategoryRule> getRules(List<Long> absenceIds) {
        if (absenceIds.isEmpty()) {
            return List.of();
        }
        return ruleRepository.findAllWithCategoryByAbsenceIds(absenceIds);
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

    private RoomMember findMember(Long roomId, Long memberId) {
        return roomMemberRepository
                .findByRoom_RoomIdAndRoomMemberId(roomId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room member " + memberId
                                + " not found in room " + roomId
                ));
    }

    private RoommateAbsence findAbsence(
            Long roomId,
            Long memberId,
            Long absenceId
    ) {
        return absenceRepository
                .findByAbsenceIdAndRoomMember_Room_RoomIdAndRoomMember_RoomMemberId(
                        absenceId,
                        roomId,
                        memberId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Absence " + absenceId + " not found for member "
                                + memberId + " in room " + roomId
                ));
    }

    private RoommateAbsenceResponse toResponse(
            RoommateAbsence absence,
            List<AbsenceCategoryRule> rules
    ) {
        RoomMember member = absence.getRoomMember();
        List<CategoryRule> categoryRules = rules.stream()
                .map(rule -> new CategoryRule(
                        rule.getCategory().getCategoryId(),
                        rule.getCategory().getCategoryName(),
                        rule.getRuleType()
                ))
                .toList();
        return new RoommateAbsenceResponse(
                absence.getAbsenceId(),
                member.getRoomMemberId(),
                member.getUser().getName(),
                absence.getDepartureDate(),
                absence.getReturnDate(),
                absence.getReason(),
                absence.getReturnDate() == null ? "ACTIVE" : "RETURNED",
                categoryRules
        );
    }
}
