package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.UpdateRentCycleMemberStatusRequest;
import com.splitroom.backend.dto.response.RentCycleMemberStatusResponse;
import com.splitroom.backend.entity.RentCycleMemberPaymentStatus;
import com.splitroom.backend.entity.RentCycleMemberStatus;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.RentCycleMemberStatusRepository;
import com.splitroom.backend.repository.RentCycleRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RentCycleMemberStatusService {

    private final RoomAuthorizationService roomAuthorizationService;
    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RentCycleRepository rentCycleRepository;
    private final RentCycleMemberStatusRepository statusRepository;

    @Transactional(readOnly = true)
    public List<RentCycleMemberStatusResponse> getStatuses(
            Long roomId,
            LocalDate startDate
    ) {
        roomAuthorizationService.requireAdmin(roomId);
        requireCycle(roomId, startDate);
        return statusRepository
                .findAllByRoom_RoomIdAndStartDate(roomId, startDate)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RentCycleMemberStatusResponse updateStatus(
            Long roomId,
            LocalDate startDate,
            Long memberId,
            UpdateRentCycleMemberStatusRequest request
    ) {
        roomAuthorizationService.requireAdmin(roomId);
        Room room = roomRepository.findByRoomIdForUpdate(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
        requireCycle(roomId, startDate);
        RoomMember member = roomMemberRepository
                .findByRoom_RoomIdAndRoomMemberId(roomId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room member " + memberId
                                + " not found in room " + roomId
                ));

        RentCycleMemberStatus status = statusRepository
                .findByRoom_RoomIdAndStartDateAndRoomMember_RoomMemberId(
                        roomId,
                        startDate,
                        memberId
                )
                .orElseGet(RentCycleMemberStatus::new);
        if (status.getStatus() == RentCycleMemberPaymentStatus.CLEAR
                && request.getStatus()
                == RentCycleMemberPaymentStatus.PENDING) {
            throw new ConflictException(
                    "A cleared payment status cannot be changed back to pending"
            );
        }
        status.setRoom(room);
        status.setRoomMember(member);
        status.setStartDate(startDate);
        status.setStatus(request.getStatus());
        return toResponse(statusRepository.save(status));
    }

    private void requireCycle(Long roomId, LocalDate startDate) {
        if (startDate.getDayOfMonth() != 7) {
            throw new ConflictException(
                    "Rent-cycle start date must be the 7th of a month"
            );
        }
        if (!rentCycleRepository
                .findByRoom_RoomIdAndStartDate(roomId, startDate)
                .isPresent()) {
            throw new ResourceNotFoundException(
                    "Rent cycle " + startDate + " not found in room " + roomId
            );
        }
    }

    private RentCycleMemberStatusResponse toResponse(
            RentCycleMemberStatus status
    ) {
        return new RentCycleMemberStatusResponse(
                status.getRoomMember().getRoomMemberId(),
                status.getStatus()
        );
    }
}
