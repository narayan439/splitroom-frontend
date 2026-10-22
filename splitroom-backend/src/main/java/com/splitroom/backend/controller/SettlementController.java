package com.splitroom.backend.controller;

import com.splitroom.backend.dto.request.CreateSettlementRequest;
import com.splitroom.backend.dto.response.SettlementResponse;
import com.splitroom.backend.entity.SettlementStatus;
import com.splitroom.backend.service.SettlementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/rooms/{roomId}/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;

    @PostMapping
    public ResponseEntity<SettlementResponse> createSettlement(
            @PathVariable @Positive Long roomId,
            @Valid @RequestBody CreateSettlementRequest request
    ) {
        SettlementResponse settlement =
                settlementService.createSettlement(roomId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(settlement);
    }

    @GetMapping
    public ResponseEntity<List<SettlementResponse>> getRoomSettlements(
            @PathVariable @Positive Long roomId,
            @RequestParam(required = false) SettlementStatus status
    ) {
        return ResponseEntity.ok(
                settlementService.getRoomSettlements(roomId, status)
        );
    }

    @GetMapping("/{settlementId}")
    public ResponseEntity<SettlementResponse> getSettlementDetails(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long settlementId
    ) {
        return ResponseEntity.ok(
                settlementService.getSettlementDetails(roomId, settlementId)
        );
    }

    @PutMapping("/{settlementId}/complete")
    public ResponseEntity<SettlementResponse> completeSettlement(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long settlementId
    ) {
        return ResponseEntity.ok(
                settlementService.completeSettlement(roomId, settlementId)
        );
    }

    @PutMapping("/{settlementId}/cancel")
    public ResponseEntity<SettlementResponse> cancelSettlement(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long settlementId
    ) {
        return ResponseEntity.ok(
                settlementService.cancelSettlement(roomId, settlementId)
        );
    }
}
