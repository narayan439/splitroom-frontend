package com.splitroom.backend.controller;

import com.splitroom.backend.dto.request.CreateInvitationRequest;
import com.splitroom.backend.dto.response.RoomInvitationResponse;
import com.splitroom.backend.entity.InvitationStatus;
import com.splitroom.backend.service.InvitationService;
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
@RequiredArgsConstructor
public class InvitationController {

    private final InvitationService invitationService;

    @PostMapping("/api/rooms/{roomId}/invitations")
    public ResponseEntity<RoomInvitationResponse> createInvitation(
            @PathVariable @Positive Long roomId,
            @Valid @RequestBody CreateInvitationRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                invitationService.createInvitation(
                        roomId,
                        request.getInvitedUserId(),
                        request.getInvitedUserEmail()
                )
        );
    }

    @GetMapping("/api/rooms/{roomId}/invitations")
    public ResponseEntity<List<RoomInvitationResponse>> getRoomInvitations(
            @PathVariable @Positive Long roomId,
            @RequestParam(required = false) InvitationStatus status
    ) {
        return ResponseEntity.ok(
                invitationService.getRoomInvitations(roomId, status)
        );
    }

    @GetMapping("/api/users/me/invitations")
    public ResponseEntity<List<RoomInvitationResponse>> getUserInvitations() {
        return ResponseEntity.ok(
                invitationService.getUserInvitations()
        );
    }

    @PutMapping("/api/invitations/{invitationId}/accept")
    public ResponseEntity<RoomInvitationResponse> acceptInvitation(
            @PathVariable @Positive Long invitationId
    ) {
        return ResponseEntity.ok(
                invitationService.acceptInvitation(invitationId)
        );
    }

    @PutMapping("/api/invitations/{invitationId}/decline")
    public ResponseEntity<RoomInvitationResponse> declineInvitation(
            @PathVariable @Positive Long invitationId
    ) {
        return ResponseEntity.ok(
                invitationService.declineInvitation(invitationId)
        );
    }

    @PutMapping("/api/invitations/{invitationId}/cancel")
    public ResponseEntity<RoomInvitationResponse> cancelInvitation(
            @PathVariable @Positive Long invitationId
    ) {
        return ResponseEntity.ok(
                invitationService.cancelInvitation(invitationId)
        );
    }
}
