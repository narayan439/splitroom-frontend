package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.AbsenceRulesRequest;
import com.splitroom.backend.dto.request.MarkAbsentRequest;
import com.splitroom.backend.entity.AbsenceCategoryRule;
import com.splitroom.backend.entity.AbsenceRuleType;
import com.splitroom.backend.entity.ExpenseCategory;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.RoommateAbsence;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.dto.response.RoommateAbsenceResponse;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.repository.AbsenceCategoryRuleRepository;
import com.splitroom.backend.repository.ExpenseCategoryRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.RoommateAbsenceRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AbsenceServiceTests {

    @Test
    void markingAbsentCreatesAnActiveHistoricalRecord() {
        Fixture fixture = new Fixture();
        when(fixture.absenceRepository.existsOverlappingAbsence(
                30L,
                LocalDate.parse("2026-10-20")
        )).thenReturn(false);
        when(fixture.absenceRepository.save(any(RoommateAbsence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        MarkAbsentRequest request = new MarkAbsentRequest();
        request.setDepartureDate(LocalDate.parse("2026-10-20"));
        request.setReason("Visiting family");

        var response = fixture.service.markAbsent(10L, 30L, request);

        assertEquals("ACTIVE", response.status());
        assertEquals(LocalDate.parse("2026-10-20"), response.departureDate());
        assertNull(response.returnDate());
        assertEquals("Visiting family", response.reason());
        verify(fixture.authorization).requireAdmin(10L);
        verify(fixture.absenceRepository).save(any(RoommateAbsence.class));
    }

    @Test
    void nonAdminsCannotMarkAbsent() {
        Fixture fixture = new Fixture();
        org.mockito.Mockito.doThrow(new ForbiddenException("Only an admin"))
                .when(fixture.authorization).requireAdmin(10L);
        MarkAbsentRequest request = new MarkAbsentRequest();
        request.setDepartureDate(LocalDate.parse("2026-10-20"));

        assertThrows(
                ForbiddenException.class,
                () -> fixture.service.markAbsent(10L, 30L, request)
        );
        verify(fixture.absenceRepository, never())
                .save(any(RoommateAbsence.class));
    }

    @Test
    void duplicateOrOverlappingAbsenceIsRejected() {
        Fixture fixture = new Fixture();
        when(fixture.authorization.requireAdmin(10L))
                .thenReturn(null);
        when(fixture.absenceRepository.existsOverlappingAbsence(
                30L,
                LocalDate.parse("2026-10-20")
        )).thenReturn(true);
        MarkAbsentRequest request = new MarkAbsentRequest();
        request.setDepartureDate(LocalDate.parse("2026-10-20"));

        assertThrows(
                ConflictException.class,
                () -> fixture.service.markAbsent(10L, 30L, request)
        );
        verify(fixture.absenceRepository, never())
                .save(any(RoommateAbsence.class));
    }

    @Test
    void returnDateBeforeDepartureIsRejectedWithoutChangingTheRecord() {
        Fixture fixture = new Fixture();
        RoommateAbsence absence = fixture.activeAbsence();
        when(fixture.absenceRepository
                .findByAbsenceIdAndRoomMember_Room_RoomIdAndRoomMember_RoomMemberId(
                        50L,
                        10L,
                        30L
                )).thenReturn(Optional.of(absence));

        assertThrows(
                ConflictException.class,
                () -> fixture.service.markReturned(
                        10L,
                        30L,
                        50L,
                        LocalDate.parse("2026-10-19")
                )
        );
        assertNull(absence.getReturnDate());
        verify(fixture.absenceRepository, never())
                .save(any(RoommateAbsence.class));
    }

    @Test
    void returningClosesTheExistingRecordAndKeepsItsIdentity() {
        Fixture fixture = new Fixture();
        RoommateAbsence absence = fixture.activeAbsence();
        when(fixture.absenceRepository
                .findByAbsenceIdAndRoomMember_Room_RoomIdAndRoomMember_RoomMemberId(
                        50L,
                        10L,
                        30L
                )).thenReturn(Optional.of(absence));
        when(fixture.absenceRepository.save(absence)).thenReturn(absence);
        when(fixture.ruleRepository.findAllWithCategoryByAbsenceIds(List.of(50L)))
                .thenReturn(List.of());

        var response = fixture.service.markReturned(
                10L,
                30L,
                50L,
                LocalDate.parse("2026-10-25")
        );

        assertEquals(50L, response.absenceId());
        assertEquals("RETURNED", response.status());
        assertEquals(LocalDate.parse("2026-10-25"), response.returnDate());
        verify(fixture.absenceRepository).save(absence);
    }

    @Test
    void absenceRulesPersistAllSupportedRuleTypes() {
        Fixture fixture = new Fixture();
        RoommateAbsence absence = fixture.activeAbsence();
        ExpenseCategory rent = fixture.category(61L, "Rent");
        ExpenseCategory utilities = fixture.category(62L, "Utilities");
        ExpenseCategory groceries = fixture.category(63L, "Groceries");
        List<ExpenseCategory> categories = List.of(rent, utilities, groceries);
        when(fixture.absenceRepository
                .findByAbsenceIdAndRoomMember_Room_RoomIdAndRoomMember_RoomMemberId(
                        50L,
                        10L,
                        30L
                )).thenReturn(Optional.of(absence));
        when(fixture.categoryRepository
                .findAllByCategoryIdInAndRoom_RoomId(
                        List.of(61L, 62L, 63L),
                        10L
                )).thenReturn(categories);
        List<AbsenceCategoryRule> persistedRules = List.of(
                fixture.rule(absence, rent, AbsenceRuleType.FULL),
                fixture.rule(absence, utilities, AbsenceRuleType.DAILY),
                fixture.rule(absence, groceries, AbsenceRuleType.EXCLUDED)
        );
        when(fixture.ruleRepository.findAllByAbsence_AbsenceId(50L))
                .thenReturn(List.of())
                .thenReturn(persistedRules);
        when(fixture.ruleRepository.saveAll(anyList()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        AbsenceRulesRequest request = new AbsenceRulesRequest();
        request.setRules(List.of(
                fixture.ruleRequest(61L, AbsenceRuleType.FULL),
                fixture.ruleRequest(62L, AbsenceRuleType.DAILY),
                fixture.ruleRequest(63L, AbsenceRuleType.EXCLUDED)
        ));

        var response = fixture.service.updateRules(10L, 30L, 50L, request);

        assertEquals(
                List.of(
                        AbsenceRuleType.FULL,
                        AbsenceRuleType.DAILY,
                        AbsenceRuleType.EXCLUDED
                ),
                response.rules().stream()
                        .map(RoommateAbsenceResponse.CategoryRule::ruleType)
                        .toList()
        );
        verify(fixture.authorization).requireAdmin(10L);
        verify(fixture.ruleRepository).saveAll(anyList());
    }

    private static final class Fixture {
        private final Room room = new Room();
        private final User user = new User();
        private final RoomMember member = new RoomMember();
        private final RoomRepository roomRepository = mock(RoomRepository.class);
        private final RoomMemberRepository memberRepository =
                mock(RoomMemberRepository.class);
        private final RoommateAbsenceRepository absenceRepository =
                mock(RoommateAbsenceRepository.class);
        private final AbsenceCategoryRuleRepository ruleRepository =
                mock(AbsenceCategoryRuleRepository.class);
        private final ExpenseCategoryRepository categoryRepository =
                mock(ExpenseCategoryRepository.class);
        private final RoomAuthorizationService authorization =
                mock(RoomAuthorizationService.class);
        private final AbsenceService service = new AbsenceService(
                roomRepository,
                memberRepository,
                absenceRepository,
                ruleRepository,
                categoryRepository,
                authorization
        );

        private Fixture() {
            room.setRoomId(10L);
            user.setUserId(7L);
            user.setName("Taylor");
            member.setRoomMemberId(30L);
            member.setRoom(room);
            member.setUser(user);
            when(roomRepository.findByRoomIdForUpdate(10L))
                    .thenReturn(Optional.of(room));
            when(memberRepository.findByRoom_RoomIdAndRoomMemberId(10L, 30L))
                    .thenReturn(Optional.of(member));
        }

        private RoommateAbsence activeAbsence() {
            RoommateAbsence absence = new RoommateAbsence();
            absence.setAbsenceId(50L);
            absence.setRoomMember(member);
            absence.setDepartureDate(LocalDate.parse("2026-10-20"));
            absence.setReason("Visiting family");
            return absence;
        }

        private ExpenseCategory category(Long id, String name) {
            ExpenseCategory category = new ExpenseCategory();
            category.setCategoryId(id);
            category.setRoom(room);
            category.setCategoryName(name);
            return category;
        }

        private AbsenceCategoryRule rule(
                RoommateAbsence absence,
                ExpenseCategory category,
                AbsenceRuleType type
        ) {
            AbsenceCategoryRule rule = new AbsenceCategoryRule();
            rule.setAbsence(absence);
            rule.setCategory(category);
            rule.setRuleType(type);
            return rule;
        }

        private AbsenceRulesRequest.RuleRequest ruleRequest(
                Long categoryId,
                AbsenceRuleType type
        ) {
            AbsenceRulesRequest.RuleRequest request =
                    new AbsenceRulesRequest.RuleRequest();
            request.setCategoryId(categoryId);
            request.setRuleType(type);
            return request;
        }
    }
}
