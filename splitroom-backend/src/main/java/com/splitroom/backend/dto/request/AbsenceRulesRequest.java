package com.splitroom.backend.dto.request;

import com.splitroom.backend.entity.AbsenceRuleType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AbsenceRulesRequest {

    @NotNull(message = "Rules are required; provide an empty list to clear rules")
    @Valid
    private List<RuleRequest> rules;

    @Getter
    @Setter
    public static class RuleRequest {

        @NotNull(message = "Category ID is required")
        @Positive(message = "Category ID must be positive")
        private Long categoryId;

        @NotNull(message = "Rule type is required")
        private AbsenceRuleType ruleType;
    }
}
