package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.UpdateRentCycleMemberStatusRequest;
import com.splitroom.backend.dto.response.RentCycleMemberStatusResponse;
import com.splitroom.backend.entity.RentCycle;
import com.splitroom.backend.entity.RentCycleMemberPaymentStatus;
import com.splitroom.backend.entity.RentCycleMemberStatus;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.repository.RentCycleMemberStatusRepository;
import com.splitroom.backend.repository.RentCycleRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RentCycleMemberStatusServiceTests {

    @Mock
    private RoomAuthorizationService roomAuthorizationService;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomMemberRepository roomMemberRepository;
    @Mock
    private RentCycleRepository rentCycleRepository;
    @Mock
    private RentCycleMemberStatusRepository statusRepository;

    private RentCycleMemberStatusService service;

    @BeforeEach
    void setUp() {
        service = new RentCycleMemberStatusService(
                roomAuthorizationService,
                roomRepository,
                roomMemberRepository,
                rentCycleRepository,
                statusRepository
        );
    }

    @Test
    void savesClearStatusAsSeparateCycleMemberMetadata() {
        LocalDate startDate = LocalDate.of(2026, 10, 7);
        Room room = new Room();
        room.setRoomId(12L);
        User user = new User();
        user.setUserId(7L);
        user.setName("Member");
        RoomMember member = new RoomMember();
        member.setRoomMemberId(21L);
        member.setUser(user);
        when(roomAuthorizationService.requireAdmin(12L)).thenReturn(member);
        when(roomRepository.findByRoomIdForUpdate(12L))
                .thenReturn(Optional.of(room));
        when(rentCycleRepository.findByRoom_RoomIdAndStartDate(12L, startDate))
                .thenReturn(Optional.of(new RentCycle()));
        when(roomMemberRepository.findByRoom_RoomIdAndRoomMemberId(12L, 21L))
                .thenReturn(Optional.of(member));
        when(statusRepository
                .findByRoom_RoomIdAndStartDateAndRoomMember_RoomMemberId(
                        12L,
                        startDate,
                        21L
                ))
                .thenReturn(Optional.empty());
        when(statusRepository.save(any(RentCycleMemberStatus.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UpdateRentCycleMemberStatusRequest request =
                new UpdateRentCycleMemberStatusRequest();
        request.setStatus(RentCycleMemberPaymentStatus.CLEAR);

        RentCycleMemberStatusResponse response =
                service.updateStatus(12L, startDate, 21L, request);

        assertEquals(21L, response.memberId());
        assertEquals(RentCycleMemberPaymentStatus.CLEAR, response.status());
        ArgumentCaptor<RentCycleMemberStatus> savedStatus =
                ArgumentCaptor.forClass(RentCycleMemberStatus.class);
        verify(statusRepository).save(savedStatus.capture());
        assertEquals(startDate, savedStatus.getValue().getStartDate());
        assertEquals(room, savedStatus.getValue().getRoom());
        assertEquals(member, savedStatus.getValue().getRoomMember());
        assertEquals(
                RentCycleMemberPaymentStatus.CLEAR,
                savedStatus.getValue().getStatus()
        );
    }

    @Test
    void rejectsDatesThatAreNotRentCycleStarts() {
        assertThrows(
                ConflictException.class,
                () -> service.getStatuses(12L, LocalDate.of(2026, 10, 6))
        );
    }

    @Test
    void doesNotAllowClearStatusToReturnToPending() {
        LocalDate startDate = LocalDate.of(2026, 10, 7);
        Room room = new Room();
        room.setRoomId(12L);
        RoomMember member = new RoomMember();
        member.setRoomMemberId(21L);
        RentCycleMemberStatus existingStatus = new RentCycleMemberStatus();
        existingStatus.setStatus(RentCycleMemberPaymentStatus.CLEAR);
        when(roomAuthorizationService.requireAdmin(12L)).thenReturn(member);
        when(roomRepository.findByRoomIdForUpdate(12L))
                .thenReturn(Optional.of(room));
        when(rentCycleRepository.findByRoom_RoomIdAndStartDate(12L, startDate))
                .thenReturn(Optional.of(new RentCycle()));
        when(roomMemberRepository.findByRoom_RoomIdAndRoomMemberId(12L, 21L))
                .thenReturn(Optional.of(member));
        when(statusRepository
                .findByRoom_RoomIdAndStartDateAndRoomMember_RoomMemberId(
                        12L,
                        startDate,
                        21L
                ))
                .thenReturn(Optional.of(existingStatus));

        UpdateRentCycleMemberStatusRequest request =
                new UpdateRentCycleMemberStatusRequest();
        request.setStatus(RentCycleMemberPaymentStatus.PENDING);

        assertThrows(
                ConflictException.class,
                () -> service.updateStatus(12L, startDate, 21L, request)
        );
        verify(statusRepository, never()).save(any());
    }
}
