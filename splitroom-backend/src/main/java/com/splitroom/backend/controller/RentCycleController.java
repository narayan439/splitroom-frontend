package com.splitroom.backend.controller;

import com.splitroom.backend.dto.request.UpdateRentCycleMemberStatusRequest;
import com.splitroom.backend.dto.response.RentCycleMemberStatusResponse;
import com.splitroom.backend.dto.response.RentCycleResponse;
import com.splitroom.backend.service.RentCycleMemberStatusService;
import com.splitroom.backend.service.RentCycleService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/rooms/{roomId}/rent-cycles")
@RequiredArgsConstructor
public class RentCycleController {

    private final RentCycleService rentCycleService;
    private final RentCycleMemberStatusService memberStatusService;

    @GetMapping
    public ResponseEntity<List<RentCycleResponse>> getRoomRentCycles(
            @PathVariable @Positive Long roomId
    ) {
        return ResponseEntity.ok(rentCycleService.getRoomRentCycles(roomId));
    }

    @GetMapping("/{startDate}/member-statuses")
    public ResponseEntity<List<RentCycleMemberStatusResponse>> getMemberStatuses(
            @PathVariable @Positive Long roomId,
            @PathVariable
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate
    ) {
        return ResponseEntity.ok(
                memberStatusService.getStatuses(roomId, startDate)
        );
    }

    @PutMapping("/{startDate}/members/{memberId}/status")
    public ResponseEntity<RentCycleMemberStatusResponse> updateMemberStatus(
            @PathVariable @Positive Long roomId,
            @PathVariable
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @PathVariable @Positive Long memberId,
            @Valid @RequestBody UpdateRentCycleMemberStatusRequest request
    ) {
        return ResponseEntity.ok(
                memberStatusService.updateStatus(
                        roomId,
                        startDate,
                        memberId,
                        request
                )
        );
    }
}
