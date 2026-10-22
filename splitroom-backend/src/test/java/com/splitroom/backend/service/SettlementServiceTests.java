package com.splitroom.backend.service;

import com.splitroom.backend.exception.ConflictException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SettlementServiceTests {

    @Test
    void permitsPaymentUpToCurrentPairDebtAndCredit() {
        assertDoesNotThrow(() -> SettlementService.validatePaymentAmount(
                new BigDecimal("200.00"),
                new BigDecimal("-500.00"),
                new BigDecimal("300.00")
        ));
    }

    @Test
    void rejectsPaymentAboveCurrentPairDebtOrCredit() {
        assertThrows(
                ConflictException.class,
                () -> SettlementService.validatePaymentAmount(
                        new BigDecimal("300.01"),
                        new BigDecimal("-500.00"),
                        new BigDecimal("300.00")
                )
        );
    }

    @Test
    void rejectsPaymentsWhenSenderHasNoDebtToReceiver() {
        assertThrows(
                ConflictException.class,
                () -> SettlementService.validatePaymentAmount(
                        new BigDecimal("0.01"),
                        new BigDecimal("100.00"),
                        new BigDecimal("-100.00")
                )
        );
    }
}
