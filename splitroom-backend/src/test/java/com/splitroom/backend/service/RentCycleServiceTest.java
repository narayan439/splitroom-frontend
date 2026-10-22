package com.splitroom.backend.service;

import com.splitroom.backend.dto.response.RentCycleResponse;
import com.splitroom.backend.entity.Expense;
import com.splitroom.backend.entity.ExpenseCategory;
import com.splitroom.backend.entity.ExpenseShare;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.Settlement;
import com.splitroom.backend.entity.SettlementStatus;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.repository.ExpenseRepository;
import com.splitroom.backend.repository.ExpenseShareRepository;
import com.splitroom.backend.repository.RentCycleRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.SettlementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyList;

@ExtendWith(MockitoExtension.class)
class RentCycleServiceTest {

    @Mock
    private RoomAuthorizationService roomAuthorizationService;
    @Mock
    private RoomMemberRepository roomMemberRepository;
    @Mock
    private ExpenseRepository expenseRepository;
    @Mock
    private ExpenseShareRepository expenseShareRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RentCycleRepository rentCycleRepository;
    @Mock
    private SettlementRepository settlementRepository;

    private RentCycleService service;
    private RoomMember alice;
    private RoomMember bob;
    private Room room;

    @BeforeEach
    void setUp() {
        service = new RentCycleService(
                roomAuthorizationService,
                roomMemberRepository,
                expenseRepository,
                expenseShareRepository,
                roomRepository,
                rentCycleRepository,
                settlementRepository
        );
        alice = member(11L, "Alice");
        bob = member(12L, "Bob");
        room = new Room();
        room.setRoomId(3L);
    }

    private void stubBaseRequests(LocalDate currentDate) {
        when(roomRepository.findByRoomIdForUpdate(3L))
                .thenReturn(java.util.Optional.of(room));
        when(rentCycleRepository.findAllByRoom_RoomIdOrderByStartDateDesc(3L))
                .thenReturn(List.of());
        when(settlementRepository.findCompletedDetailsByRoomIdThroughDate(
                3L,
                currentDate
        )).thenReturn(List.of());
    }

    @Test
    void assignsSixthToEndingCycleAndSeventhToNewCycleWithMemberTotals() {
        stubBaseRequests(LocalDate.of(2026, 11, 7));
        when(roomMemberRepository.findAllByRoomIdWithUser(3L))
                .thenReturn(List.of(alice, bob));
        LocalDate rentDate = LocalDate.of(2026, 11, 6);
        Expense rent = expense(51L, "Monthly rent", "Rent", "100.00", rentDate, alice);
        Expense groceries = expense(
                52L,
                "Groceries",
                "Groceries",
                "50.00",
                LocalDate.of(2026, 11, 7),
                bob
        );
        when(expenseRepository.findAllByRoomIdWithDetails(3L))
                .thenReturn(List.of(groceries, rent));
        when(expenseShareRepository.findAllDetailsByRoomId(3L))
                .thenReturn(List.of(
                        share(101L, rent, alice, "60.00"),
                        share(102L, rent, bob, "40.00"),
                        share(103L, groceries, alice, "25.00"),
                        share(104L, groceries, bob, "25.00")
                ));

        List<RentCycleResponse> cycles = service.getRoomRentCycles(
                3L,
                LocalDate.of(2026, 11, 7)
        );

        RentCycleResponse octoberCycle = findCycle(cycles, LocalDate.of(2026, 10, 7));
        assertEquals(LocalDate.of(2026, 11, 6), octoberCycle.endDate());
        assertMoney("100.00", octoberCycle.rentAmount());
        assertMoney("100.00", octoberCycle.expenseTotal());
        assertEquals("NOT_TRACKED", octoberCycle.rentPaymentStatus());
        assertEquals(1, octoberCycle.expenses().size());
        assertMoney("100.00", octoberCycle.members().get(0).paidAmount());
        assertMoney("60.00", octoberCycle.members().get(0).shareAmount());
        assertMoney("40.00", octoberCycle.members().get(0).netBalance());
        assertMoney("0.00", octoberCycle.members().get(1).paidAmount());
        assertMoney("40.00", octoberCycle.members().get(1).shareAmount());
        assertMoney("-40.00", octoberCycle.members().get(1).netBalance());

        RentCycleResponse novemberCycle = findCycle(cycles, LocalDate.of(2026, 11, 7));
        assertEquals(LocalDate.of(2026, 12, 6), novemberCycle.endDate());
        assertMoney("0.00", novemberCycle.rentAmount());
        assertMoney("50.00", novemberCycle.expenseTotal());
        assertEquals(1, novemberCycle.expenses().size());
        assertMoney("25.00", novemberCycle.members().get(0).shareAmount());
        assertMoney("0.00", novemberCycle.members().get(0).paidAmount());
        assertMoney("-25.00", novemberCycle.members().get(0).netBalance());
        assertMoney("50.00", novemberCycle.members().get(1).paidAmount());
        assertMoney("25.00", novemberCycle.members().get(1).shareAmount());
        assertMoney("25.00", novemberCycle.members().get(1).netBalance());
    }

    @Test
    void createsZeroCurrentCycleWithoutChangingFinancialRecords() {
        stubBaseRequests(LocalDate.of(2026, 11, 7));
        when(roomMemberRepository.findAllByRoomIdWithUser(3L))
                .thenReturn(List.of(alice, bob));
        when(expenseRepository.findAllByRoomIdWithDetails(3L)).thenReturn(List.of());
        when(expenseShareRepository.findAllDetailsByRoomId(3L)).thenReturn(List.of());

        List<RentCycleResponse> cycles = service.getRoomRentCycles(
                3L,
                LocalDate.of(2026, 11, 7)
        );

        assertEquals(1, cycles.size());
        assertEquals(LocalDate.of(2026, 11, 7), cycles.get(0).startDate());
        assertMoney("0.00", cycles.get(0).rentAmount());
        assertMoney("0.00", cycles.get(0).expenseTotal());
        assertTrue(cycles.get(0).expenses().isEmpty());
        assertMoney("0.00", cycles.get(0).members().get(0).shareAmount());
        assertMoney("0.00", cycles.get(0).members().get(0).paidAmount());
        verify(rentCycleRepository).saveAll(anyList());
        verify(expenseRepository, never()).deleteAll();
        verify(expenseShareRepository, never()).deleteAll();
    }

    @Test
    void calculatesCycleStartAcrossTheDecemberYearBoundary() {
        assertEquals(
                LocalDate.of(2025, 12, 7),
                RentCycleService.cycleStartFor(LocalDate.of(2026, 1, 6))
        );
        assertEquals(
                LocalDate.of(2026, 1, 7),
                RentCycleService.cycleStartFor(LocalDate.of(2026, 1, 7))
        );
    }

    @Test
    void appliesCompletedSettlementOnlyInItsSettlementCycle() {
        stubBaseRequests(LocalDate.of(2026, 11, 8));
        when(roomMemberRepository.findAllByRoomIdWithUser(3L))
                .thenReturn(List.of(alice, bob));
        when(expenseRepository.findAllByRoomIdWithDetails(3L))
                .thenReturn(List.of());
        when(expenseShareRepository.findAllDetailsByRoomId(3L))
                .thenReturn(List.of());
        Settlement settlement = new Settlement();
        settlement.setFromMember(alice);
        settlement.setToMember(bob);
        settlement.setAmount(new BigDecimal("20.00"));
        settlement.setSettlementDate(LocalDate.of(2026, 11, 7));
        settlement.setStatus(SettlementStatus.COMPLETED);
        when(settlementRepository.findCompletedDetailsByRoomIdThroughDate(
                3L,
                LocalDate.of(2026, 11, 8)
        )).thenReturn(List.of(settlement));

        List<RentCycleResponse> cycles = service.getRoomRentCycles(
                3L,
                LocalDate.of(2026, 11, 8)
        );

        RentCycleResponse currentCycle =
                findCycle(cycles, LocalDate.of(2026, 11, 7));
        assertMoney("20.00", currentCycle.members().get(0).netBalance());
        assertMoney("20.00", currentCycle.members().get(0).completedSettlementsSent());
        assertMoney("0.00", currentCycle.members().get(0).completedSettlementsReceived());
        assertMoney("-20.00", currentCycle.members().get(1).netBalance());
        assertMoney("0.00", currentCycle.members().get(1).completedSettlementsSent());
        assertMoney("20.00", currentCycle.members().get(1).completedSettlementsReceived());
    }

    @Test
    void calculatesSeventyThousandCycleAndNegativeNetPositionPrecisely() {
        stubBaseRequests(LocalDate.of(2026, 11, 9));
        when(roomMemberRepository.findAllByRoomIdWithUser(3L))
                .thenReturn(List.of(alice, bob));
        Expense alicePayment = expense(
                71L,
                "Rent payment",
                "Rent",
                "30000.00",
                LocalDate.of(2026, 11, 8),
                alice
        );
        Expense bobPayment = expense(
                72L,
                "Utilities",
                "Electricity",
                "40000.00",
                LocalDate.of(2026, 11, 9),
                bob
        );
        when(expenseRepository.findAllByRoomIdWithDetails(3L))
                .thenReturn(List.of(bobPayment, alicePayment));
        when(expenseShareRepository.findAllDetailsByRoomId(3L))
                .thenReturn(List.of(
                        share(201L, alicePayment, alice, "20000.00"),
                        share(202L, alicePayment, bob, "10000.00"),
                        share(203L, bobPayment, alice, "23333.36"),
                        share(204L, bobPayment, bob, "16666.64")
                ));

        List<RentCycleResponse> cycles = service.getRoomRentCycles(
                3L,
                LocalDate.of(2026, 11, 9)
        );

        RentCycleResponse cycle = findCycle(cycles, LocalDate.of(2026, 11, 7));
        assertMoney("70000.00", cycle.expenseTotal());
        assertMoney("-13333.36", cycle.members().get(0).netBalance());
        assertMoney("13333.36", cycle.members().get(1).netBalance());
    }

    private static RentCycleResponse findCycle(
            List<RentCycleResponse> cycles,
            LocalDate startDate
    ) {
        return cycles.stream()
                .filter(cycle -> cycle.startDate().equals(startDate))
                .findFirst()
                .orElseThrow();
    }

    private static RoomMember member(Long id, String name) {
        User user = new User();
        user.setName(name);
        RoomMember member = new RoomMember();
        member.setRoomMemberId(id);
        member.setUser(user);
        return member;
    }

    private static Expense expense(
            Long id,
            String title,
            String categoryName,
            String amount,
            LocalDate date,
            RoomMember payer
    ) {
        ExpenseCategory category = new ExpenseCategory();
        category.setCategoryName(categoryName);
        Expense expense = new Expense();
        expense.setExpenseId(id);
        expense.setTitle(title);
        expense.setAmount(new BigDecimal(amount));
        expense.setExpenseDate(date);
        expense.setCategory(category);
        expense.setPaidBy(payer);
        return expense;
    }

    private static ExpenseShare share(
            Long id,
            Expense expense,
            RoomMember member,
            String amount
    ) {
        ExpenseShare share = new ExpenseShare();
        share.setShareId(id);
        share.setExpense(expense);
        share.setRoomMember(member);
        share.setShareAmount(new BigDecimal(amount));
        return share;
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
