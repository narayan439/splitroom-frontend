package com.splitroom.backend.service;

import com.splitroom.backend.dto.response.MemberBalanceResponse;
import com.splitroom.backend.dto.response.SettlementSuggestionsResponse.TransferSuggestion;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class BalanceServiceTests {

    @Test
    void matchesDebtorsToCreditorsWithoutCreatingSelfTransfers() {
        List<MemberBalanceResponse> balances = List.of(
                balance(1L, "Narayan", "600.00"),
                balance(2L, "Rahul", "-200.00"),
                balance(3L, "Amit", "-400.00")
        );

        List<TransferSuggestion> suggestions =
                BalanceService.suggestTransfers(balances);

        assertEquals(2, suggestions.size());
        assertEquals(2L, suggestions.get(0).fromMemberId());
        assertEquals(1L, suggestions.get(0).toMemberId());
        assertEquals(new BigDecimal("200.00"), suggestions.get(0).amount());
        assertEquals(3L, suggestions.get(1).fromMemberId());
        assertEquals(1L, suggestions.get(1).toMemberId());
        assertEquals(new BigDecimal("400.00"), suggestions.get(1).amount());
        assertFalse(suggestions.stream().anyMatch(suggestion ->
                suggestion.fromMemberId().equals(suggestion.toMemberId())
        ));
    }

    @Test
    void returnsNoTransfersWhenRoomMembersHaveZeroBalances() {
        assertEquals(
                List.of(),
                BalanceService.suggestTransfers(List.of(
                        balance(1L, "Narayan", "0.00"),
                        balance(2L, "Rahul", "0.00")
                ))
        );
    }

    @Test
    void completedSettlementsReduceSenderDebtAndReceiverCredit() {
        MemberBalanceResponse senderAfterPayment =
                new MemberBalanceResponse(
                        10L,
                        "Maple House",
                        2L,
                        "Rahul",
                        new BigDecimal("0.00"),
                        new BigDecimal("500.00"),
                        new BigDecimal("200.00"),
                        new BigDecimal("0.00")
                );
        MemberBalanceResponse receiverAfterPayment =
                new MemberBalanceResponse(
                        10L,
                        "Maple House",
                        1L,
                        "Narayan",
                        new BigDecimal("900.00"),
                        new BigDecimal("300.00"),
                        new BigDecimal("0.00"),
                        new BigDecimal("200.00")
                );
        MemberBalanceResponse otherDebtor =
                balance(3L, "Amit", "-100.00");

        assertEquals(new BigDecimal("-300.00"), senderAfterPayment.netBalance());
        assertEquals(new BigDecimal("400.00"), receiverAfterPayment.netBalance());
        assertEquals(
                BigDecimal.ZERO.setScale(2),
                senderAfterPayment.netBalance()
                        .add(receiverAfterPayment.netBalance())
                        .add(otherDebtor.netBalance())
        );
    }

    private MemberBalanceResponse balance(
            Long memberId,
            String name,
            String netBalance
    ) {
        return new MemberBalanceResponse(
                10L,
                "Maple House",
                memberId,
                name,
                new BigDecimal("0.00"),
                new BigDecimal("0.00"),
                new BigDecimal(netBalance)
        );
    }
}
