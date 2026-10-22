package com.splitroom.backend.controller;

import com.splitroom.backend.dto.response.ExpenseCategoryResponse;
import com.splitroom.backend.service.ExpenseCategoryService;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/rooms/{roomId}/expense-categories")
@RequiredArgsConstructor
public class ExpenseCategoryController {

    private final ExpenseCategoryService categoryService;

    @GetMapping
    public ResponseEntity<List<ExpenseCategoryResponse>> getRoomCategories(
            @PathVariable @Positive Long roomId
    ) {
        return ResponseEntity.ok(categoryService.getRoomCategories(roomId)
                .stream()
                .map(category -> new ExpenseCategoryResponse(
                        category.getCategoryId(),
                        category.getCategoryName()
                ))
                .toList());
    }
}
