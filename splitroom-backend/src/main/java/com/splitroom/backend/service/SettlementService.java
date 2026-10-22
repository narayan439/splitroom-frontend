package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.CreateSettlementRequest;
import com.splitroom.backend.dto.response.MemberBalanceResponse;
import com.splitroom.backend.dto.response.SettlementResponse;
import com.splitroom.backend.dto.response.SettlementResponse.MemberDetails;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.Settlement;
import com.splitroom.backend.entity.SettlementStatus;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.SettlementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final SettlementRepository settlementRepository;
    private final RoomAuthorizationService roomAuthorizationService;

    @Transactional
    public SettlementResponse createSettlement(
            Long roomId,
            CreateSettlementRequest request
    ) {
        Room room = findRoomForUpdate(roomId);
        roomAuthorizationService.requireOwnMembership(
                roomId,
                request.getFromMemberId()
        );
        if (request.getFromMemberId().equals(request.getToMemberId())) {
            throw new ConflictException(
                    "A member cannot send a settlement payment to themselves"
            );
        }

        RoomMember sender = findMember(roomId, request.getFromMemberId());
        RoomMember receiver = findMember(roomId, request.getToMemberId());

        Settlement settlement = new Settlement();
        settlement.setRoom(room);
        settlement.setFromMember(sender);
        settlement.setToMember(receiver);
        settlement.setAmount(request.getAmount().setScale(
                2,
                RoundingMode.UNNECESSARY
        ));
        settlement.setSettlementDate(request.getSettlementDate());
        settlement.setStatus(SettlementStatus.PENDING);

        return toResponse(settlementRepository.save(settlement));
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> getRoomSettlements(
            Long roomId,
            SettlementStatus status
    ) {
        roomAuthorizationService.requireMember(roomId);
        findRoom(roomId);
        return settlementRepository
                .findAllByRoomIdAndOptionalStatus(roomId, status)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SettlementResponse getSettlementDetails(
            Long roomId,
            Long settlementId
    ) {
        roomAuthorizationService.requireMember(roomId);
        findRoom(roomId);
        Settlement settlement = findSettlementDetails(roomId, settlementId);
        requireSettlementParticipant(roomId, settlement);
        return toResponse(settlement);
    }

    @Transactional
    public SettlementResponse completeSettlement(
            Long roomId,
            Long settlementId
    ) {
        findRoomForUpdate(roomId);
        RoomMember requester =
                roomAuthorizationService.requireMember(roomId);
        Settlement settlement = findSettlementForUpdate(roomId, settlementId);
        requireSettlementParticipant(requester, settlement);

        if (settlement.getStatus() != SettlementStatus.PENDING) {
            throw new ConflictException(
                    "Only a pending settlement can be completed"
            );
        }

        validateOutstandingDebt(settlement);
        settlement.setStatus(SettlementStatus.COMPLETED);
        settlement.setCompletedAt(java.time.LocalDateTime.now());
        return toResponse(settlementRepository.save(settlement));
    }

    @Transactional
    public SettlementResponse cancelSettlement(
            Long roomId,
            Long settlementId
    ) {
        findRoomForUpdate(roomId);
        RoomMember requester =
                roomAuthorizationService.requireMember(roomId);
        Settlement settlement = findSettlementForUpdate(roomId, settlementId);
        if (requester.getRole() != com.splitroom.backend.entity.UserRole.ADMIN) {
            throw new ForbiddenException(
                    "Only a room admin may cancel a settlement"
            );
        }

        if (settlement.getStatus() != SettlementStatus.PENDING) {
            throw new ConflictException(
                    "Only a pending settlement can be cancelled"
            );
        }

        settlement.setStatus(SettlementStatus.CANCELLED);
        return toResponse(settlementRepository.save(settlement));
    }

    private void requireSettlementParticipant(
            Long roomId,
            Settlement settlement
    ) {
        RoomMember requester = roomAuthorizationService.requireMember(roomId);
        requireSettlementParticipant(requester, settlement);
    }

    private void requireSettlementParticipant(
            RoomMember requester,
            Settlement settlement
    ) {
        if (requester.getRole() == com.splitroom.backend.entity.UserRole.ADMIN) {
            return;
        }
        Long requesterId = requester.getRoomMemberId();
        if (!requesterId.equals(settlement.getFromMember().getRoomMemberId())
                && !requesterId.equals(settlement.getToMember().getRoomMemberId())) {
            throw new ForbiddenException(
                    "Only a settlement participant or room admin may access it"
            );
        }
    }

    private void validateOutstandingDebt(Settlement settlement) {
        List<MemberBalanceResponse> balances =
                roomMemberRepository.findBalancesByRoomId(
                        settlement.getRoom().getRoomId()
                );

        BigDecimal senderBalance = balances.stream()
                .filter(balance -> balance.memberId().equals(
                        settlement.getFromMember().getRoomMemberId()
                ))
                .map(MemberBalanceResponse::netBalance)
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Settlement sender is no longer a member of the room"
                ));

        BigDecimal receiverBalance = balances.stream()
                .filter(balance -> balance.memberId().equals(
                        settlement.getToMember().getRoomMemberId()
                ))
                .map(MemberBalanceResponse::netBalance)
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Settlement receiver is no longer a member of the room"
                ));

        validatePaymentAmount(
                settlement.getAmount(),
                senderBalance,
                receiverBalance
        );
    }

    static void validatePaymentAmount(
            BigDecimal amount,
            BigDecimal senderBalance,
            BigDecimal receiverBalance
    ) {
        BigDecimal outstandingDebt = senderBalance.signum() < 0
                && receiverBalance.signum() > 0
                ? senderBalance.abs().min(receiverBalance)
                : BigDecimal.ZERO.setScale(2);

        if (amount.compareTo(outstandingDebt) > 0) {
            throw new ConflictException(
                    "Settlement amount " + amount
                            + " exceeds the current amount owed between these members ("
                            + outstandingDebt + ")"
            );
        }
    }

    private Room findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
    }

    private Room findRoomForUpdate(Long roomId) {
        return roomRepository.findByRoomIdForUpdate(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
    }

    private RoomMember findMember(Long roomId, Long memberId) {
        return roomMemberRepository
                .findByRoom_RoomIdAndRoomMemberId(roomId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room member " + memberId
                                + " not found in room " + roomId
                ));
    }

    private Settlement findSettlementForUpdate(
            Long roomId,
            Long settlementId
    ) {
        return settlementRepository
                .findByRoomIdAndSettlementIdForUpdate(roomId, settlementId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Settlement " + settlementId
                                + " not found in room " + roomId
                ));
    }

    private Settlement findSettlementDetails(Long roomId, Long settlementId) {
        return settlementRepository
                .findDetailsByRoomIdAndSettlementId(roomId, settlementId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Settlement " + settlementId
                                + " not found in room " + roomId
                ));
    }

    private SettlementResponse toResponse(Settlement settlement) {
        return new SettlementResponse(
                settlement.getSettlementId(),
                settlement.getRoom().getRoomId(),
                toMemberDetails(settlement.getFromMember()),
                toMemberDetails(settlement.getToMember()),
                settlement.getAmount(),
                settlement.getSettlementDate(),
                settlement.getStatus(),
                settlement.getCreatedAt(),
                settlement.getCompletedAt()
        );
    }

    private MemberDetails toMemberDetails(RoomMember member) {
        return new MemberDetails(
                member.getRoomMemberId(),
                member.getUser().getUserId(),
                member.getUser().getName()
        );
    }
}
