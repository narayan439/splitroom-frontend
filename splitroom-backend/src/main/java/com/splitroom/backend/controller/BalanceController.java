package com.splitroom.backend.controller;

import com.splitroom.backend.dto.response.MemberBalanceResponse;
import com.splitroom.backend.dto.response.SettlementSuggestionsResponse;
import com.splitroom.backend.service.BalanceService;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/rooms/{roomId}")
@RequiredArgsConstructor
public class BalanceController {

    private final BalanceService balanceService;

    @GetMapping("/balances")
    public ResponseEntity<List<MemberBalanceResponse>> getRoomBalances(
            @PathVariable @Positive Long roomId
    ) {
        return ResponseEntity.ok(balanceService.getRoomBalances(roomId));
    }

    @GetMapping("/settlement-suggestions")
    public ResponseEntity<SettlementSuggestionsResponse> getSettlementSuggestions(
            @PathVariable @Positive Long roomId
    ) {
        return ResponseEntity.ok(
                balanceService.getSettlementSuggestions(roomId)
        );
    }
}
