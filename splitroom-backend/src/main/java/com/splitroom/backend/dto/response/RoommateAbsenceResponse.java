package com.splitroom.backend.dto.response;

import com.splitroom.backend.entity.AbsenceRuleType;

import java.time.LocalDate;
import java.util.List;

public record RoommateAbsenceResponse(
        Long absenceId,
        Long memberId,
        String memberName,
        LocalDate departureDate,
        LocalDate returnDate,
        String reason,
        String status,
        List<CategoryRule> rules
) {
    public RoommateAbsenceResponse {
        rules = List.copyOf(rules);
    }

    public record CategoryRule(
            Long categoryId,
            String categoryName,
            AbsenceRuleType ruleType
    ) {
    }
}
