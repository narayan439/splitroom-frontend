package com.splitroom.backend.controller;

import com.splitroom.backend.dto.request.ExpenseRequest;
import com.splitroom.backend.dto.response.ExpenseDetailsResponse;
import com.splitroom.backend.dto.response.ExpenseSummaryResponse;
import com.splitroom.backend.dto.response.MessageResponse;
import com.splitroom.backend.service.ExpenseService;
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
@RequestMapping("/api/rooms/{roomId}/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    @PostMapping
    public ResponseEntity<ExpenseDetailsResponse> createExpense(
            @PathVariable @Positive Long roomId,
            @Valid @RequestBody ExpenseRequest request
    ) {
        ExpenseDetailsResponse response =
                expenseService.createExpense(roomId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ExpenseSummaryResponse>> getExpensesByRoom(
            @PathVariable @Positive Long roomId
    ) {
        return ResponseEntity.ok(expenseService.getExpensesByRoom(roomId));
    }

    @GetMapping("/{expenseId}")
    public ResponseEntity<ExpenseDetailsResponse> getExpenseDetails(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long expenseId
    ) {
        return ResponseEntity.ok(
                expenseService.getExpenseDetails(roomId, expenseId)
        );
    }

    @PutMapping("/{expenseId}")
    public ResponseEntity<ExpenseDetailsResponse> updateExpense(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long expenseId,
            @Valid @RequestBody ExpenseRequest request
    ) {
        return ResponseEntity.ok(
                expenseService.updateExpense(roomId, expenseId, request)
        );
    }

    @DeleteMapping("/{expenseId}")
    public ResponseEntity<MessageResponse> deleteExpense(
            @PathVariable @Positive Long roomId,
            @PathVariable @Positive Long expenseId
    ) {
        expenseService.deleteExpense(roomId, expenseId);
        return ResponseEntity.ok(new MessageResponse(
                "Expense deleted successfully"
        ));
    }
}
