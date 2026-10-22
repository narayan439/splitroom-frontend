package com.splitroom.backend.service;

import com.splitroom.backend.dto.response.MemberBalanceResponse;
import com.splitroom.backend.dto.response.SettlementSuggestionsResponse;
import com.splitroom.backend.dto.response.SettlementSuggestionsResponse.TransferSuggestion;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BalanceService {

    private static final BigDecimal ZERO_MONEY = new BigDecimal("0.00");

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoomAuthorizationService roomAuthorizationService;

    @Transactional(readOnly = true)
    public List<MemberBalanceResponse> getRoomBalances(Long roomId) {
        roomAuthorizationService.requireMember(roomId);
        findRoom(roomId);
        return roomMemberRepository.findBalancesByRoomId(roomId);
    }

    @Transactional(readOnly = true)
    public SettlementSuggestionsResponse getSettlementSuggestions(Long roomId) {
        roomAuthorizationService.requireMember(roomId);
        Room room = findRoom(roomId);
        List<MemberBalanceResponse> balances =
                roomMemberRepository.findBalancesByRoomId(roomId);

        return new SettlementSuggestionsResponse(
                room.getRoomId(),
                room.getRoomName(),
                suggestTransfers(balances)
        );
    }

    static List<TransferSuggestion> suggestTransfers(
            List<MemberBalanceResponse> balances
    ) {
        List<BalanceEntry> creditors = balances.stream()
                .filter(balance -> balance.netBalance().signum() > 0)
                .sorted(Comparator.comparing(MemberBalanceResponse::memberId))
                .map(BalanceEntry::new)
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
        List<BalanceEntry> debtors = balances.stream()
                .filter(balance -> balance.netBalance().signum() < 0)
                .sorted(Comparator.comparing(MemberBalanceResponse::memberId))
                .map(BalanceEntry::new)
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);

        List<TransferSuggestion> suggestions = new ArrayList<>();
        int debtorIndex = 0;
        int creditorIndex = 0;

        while (debtorIndex < debtors.size()
                && creditorIndex < creditors.size()) {
            BalanceEntry debtor = debtors.get(debtorIndex);
            BalanceEntry creditor = creditors.get(creditorIndex);
            BigDecimal amount = debtor.remaining.min(creditor.remaining)
                    .setScale(2, RoundingMode.UNNECESSARY);

            if (!debtor.member.memberId().equals(creditor.member.memberId())) {
                suggestions.add(new TransferSuggestion(
                        debtor.member.memberId(),
                        debtor.member.memberName(),
                        creditor.member.memberId(),
                        creditor.member.memberName(),
                        amount
                ));
            }

            debtor.remaining = debtor.remaining.subtract(amount);
            creditor.remaining = creditor.remaining.subtract(amount);

            if (debtor.remaining.compareTo(ZERO_MONEY) == 0) {
                debtorIndex++;
            }
            if (creditor.remaining.compareTo(ZERO_MONEY) == 0) {
                creditorIndex++;
            }
        }

        return List.copyOf(suggestions);
    }

    private Room findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
    }

    private static final class BalanceEntry {
        private final MemberBalanceResponse member;
        private BigDecimal remaining;

        private BalanceEntry(MemberBalanceResponse member) {
            this.member = member;
            this.remaining = member.netBalance().abs()
                    .setScale(2, RoundingMode.UNNECESSARY);
        }
    }
}
