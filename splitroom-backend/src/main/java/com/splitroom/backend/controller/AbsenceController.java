package com.splitroom.backend.controller;

import com.splitroom.backend.dto.request.AbsenceRulesRequest;
import com.splitroom.backend.dto.request.MarkAbsentRequest;
import com.splitroom.backend.dto.request.MarkReturnedRequest;
import com.splitroom.backend.dto.response.RoommateAbsenceResponse;
import com.splitroom.backend.service.AbsenceService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/rooms/{roomId}/members/{memberId}/absences")
@RequiredArgsConstructor
public class AbsenceController {

    private final AbsenceService absenceService;

    @PostMapping
    public ResponseEntity<RoommateAbsenceResponse> markAbsent(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long memberId,
            @Valid @RequestBody MarkAbsentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                absenceService.markAbsent(roomId, memberId, request)
        );
    }

    @PutMapping("/{absenceId}/return")
    public ResponseEntity<RoommateAbsenceResponse> markReturned(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long memberId,
            @PathVariable @Positive Long absenceId,
            @Valid @RequestBody MarkReturnedRequest request
    ) {
        return ResponseEntity.ok(absenceService.markReturned(
                roomId,
                memberId,
                absenceId,
                request.getReturnDate()
        ));
    }

    @GetMapping
    public ResponseEntity<List<RoommateAbsenceResponse>> getAbsenceHistory(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long memberId
    ) {
        return ResponseEntity.ok(
                absenceService.getAbsenceHistory(roomId, memberId)
        );
    }

    @PutMapping("/{absenceId}/rules")
    public ResponseEntity<RoommateAbsenceResponse> updateRules(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long memberId,
            @PathVariable @Positive Long absenceId,
            @Valid @RequestBody AbsenceRulesRequest request
    ) {
        return ResponseEntity.ok(absenceService.updateRules(
                roomId,
                memberId,
                absenceId,
                request
        ));
    }
}
