package com.splitroom.backend.service;

import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ForbiddenException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ExpenseServiceTests {

    @Test
    void distributesRemainderCentsInParticipantOrder() {
        List<BigDecimal> shares = ExpenseService.calculateEqualShares(
                new BigDecimal("100.00"),
                3
        );

        assertEquals(
                List.of(
                        new BigDecimal("33.34"),
                        new BigDecimal("33.33"),
                        new BigDecimal("33.33")
                ),
                shares
        );
        assertEquals(new BigDecimal("100.00"), shares.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    @Test
    void rejectsAZeroParticipantSplit() {
        assertThrows(
                IllegalArgumentException.class,
                () -> ExpenseService.calculateEqualShares(
                        new BigDecimal("1.00"),
                        0
                )
        );
    }

    @Test
    void roomAdminMayRecordAnExpensePaidByAnotherRoomMember() {
        RoomMember admin = roomMember(31L, UserRole.ADMIN);

        ExpenseService.requireAllowedPayer(admin, 32L);
    }

    @Test
    void roomMemberMayOnlyRecordAnExpenseUnderTheirOwnMembership() {
        RoomMember member = roomMember(31L, UserRole.MEMBER);

        ExpenseService.requireAllowedPayer(member, 31L);
        assertThrows(
                ForbiddenException.class,
                () -> ExpenseService.requireAllowedPayer(member, 32L)
        );
    }

    @Test
    void anyRoomMemberMayRecordAnExpenseWithoutAnIndividualPayer() {
        RoomMember admin = roomMember(31L, UserRole.ADMIN);
        RoomMember member = roomMember(32L, UserRole.MEMBER);

        ExpenseService.requireAllowedPayer(admin, null);
        ExpenseService.requireAllowedPayer(member, null);
    }

    @Test
    void onlyRoomAdminsMayEditAnExpense() {
        RoomMember admin = roomMember(31L, UserRole.ADMIN);
        RoomMember member = roomMember(32L, UserRole.MEMBER);

        ExpenseService.requireAdminExpenseEditor(admin);
        assertThrows(
                ForbiddenException.class,
                () -> ExpenseService.requireAdminExpenseEditor(member)
        );
    }

    @Test
    void dailyWeightProratesAgainstFullMonthParticipants() {
        List<BigDecimal> shares = ExpenseService.calculateWeightedShares(
                new BigDecimal("780.00"),
                List.of(31, 31, 16)
        );

        assertEquals(
                List.of(
                        new BigDecimal("310.00"),
                        new BigDecimal("310.00"),
                        new BigDecimal("160.00")
                ),
                shares
        );
        assertEquals(new BigDecimal("780.00"), shares.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    @Test
    void assignsWeightedRemainderCentsInDeterministicOrder() {
        assertEquals(
                List.of(
                        new BigDecimal("33.34"),
                        new BigDecimal("33.33"),
                        new BigDecimal("33.33")
                ),
                ExpenseService.calculateWeightedShares(
                        new BigDecimal("100.00"),
                        List.of(1, 1, 1)
                )
        );
    }

    @Test
    void equalSharesForTwentyThousandSumToExpenseAmount() {
        List<BigDecimal> shares = ExpenseService.calculateWeightedShares(
                new BigDecimal("20000.00"),
                List.of(31, 31, 31)
        );

        assertEquals(
                List.of(
                        new BigDecimal("6666.67"),
                        new BigDecimal("6666.67"),
                        new BigDecimal("6666.66")
                ),
                shares
        );
        assertEquals(
                new BigDecimal("20000.00"),
                shares.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
        );
    }

    private RoomMember roomMember(Long memberId, UserRole role) {
        Room room = new Room();
        room.setRoomId(12L);
        RoomMember member = new RoomMember();
        member.setRoomMemberId(memberId);
        member.setRoom(room);
        member.setRole(role);
        return member;
    }
}
