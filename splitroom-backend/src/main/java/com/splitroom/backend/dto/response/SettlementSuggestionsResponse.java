package com.splitroom.backend.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record SettlementSuggestionsResponse(
        Long roomId,
        String roomName,
        List<TransferSuggestion> suggestions
) {
    public SettlementSuggestionsResponse {
        suggestions = List.copyOf(suggestions);
    }

    public record TransferSuggestion(
            Long fromMemberId,
            String fromMemberName,
            Long toMemberId,
            String toMemberName,
            BigDecimal amount
    ) {
    }
}
