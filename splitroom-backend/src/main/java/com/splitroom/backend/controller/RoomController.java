package com.splitroom.backend.controller;

import com.splitroom.backend.dto.request.CreateRoomRequest;
import com.splitroom.backend.dto.response.AdminTransferResponse;
import com.splitroom.backend.dto.response.MessageResponse;
import com.splitroom.backend.dto.response.RoomDetailsResponse;
import com.splitroom.backend.dto.response.RoomMemberResponse;
import com.splitroom.backend.service.RoomService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping
    public ResponseEntity<List<RoomDetailsResponse>> getAllRooms() {
        return ResponseEntity.ok(roomService.getAllRooms());
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<RoomDetailsResponse> getRoomById(
            @PathVariable @Positive Long roomId
    ) {
        return ResponseEntity.ok(roomService.getRoomById(roomId));
    }

    @GetMapping("/my")
    public ResponseEntity<List<RoomDetailsResponse>> getMyRooms() {
        return ResponseEntity.ok(roomService.getRoomsByCurrentUser());
    }

    @PostMapping
    public ResponseEntity<RoomDetailsResponse> createRoom(
            @Valid @RequestBody CreateRoomRequest request
    ) {
        RoomDetailsResponse room = roomService.createRoom(request.getRoomName());
        return ResponseEntity.status(HttpStatus.CREATED).body(room);
    }

    @PostMapping("/{roomId}/members/{userId}")
    public ResponseEntity<RoomMemberResponse> addMemberToRoom(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long userId
    ) {
        RoomMemberResponse member =
                roomService.addMemberToRoom(roomId, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(member);
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<List<RoomMemberResponse>> getRoomMembers(
            @PathVariable @Positive Long roomId
    ) {
        return ResponseEntity.ok(roomService.getRoomMembers(roomId));
    }

    @DeleteMapping("/{roomId}/members/{userId}")
    public ResponseEntity<MessageResponse> removeMemberFromRoom(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long userId
    ) {
        roomService.removeMemberFromRoom(roomId, userId);
        return ResponseEntity.ok(new MessageResponse(
                "Room member removed successfully"
        ));
    }

    @PutMapping("/{roomId}/admin/{userId}")
    public ResponseEntity<AdminTransferResponse> transferAdmin(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long userId
    ) {
        return ResponseEntity.ok(
                roomService.transferAdmin(roomId, userId)
        );
    }
}
