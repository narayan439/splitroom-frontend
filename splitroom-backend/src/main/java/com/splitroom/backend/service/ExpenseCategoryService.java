package com.splitroom.backend.service;

import com.splitroom.backend.entity.ExpenseCategory;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.ExpenseCategoryRepository;
import com.splitroom.backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ExpenseCategoryService {

    private static final List<String> DEFAULT_CATEGORIES = List.of(
            "Rent",
            "Electricity",
            "Groceries",
            "Water",
            "Other"
    );

    private final ExpenseCategoryRepository categoryRepository;
    private final RoomRepository roomRepository;
    private final RoomAuthorizationService roomAuthorizationService;

    @Transactional
    public List<ExpenseCategory> getRoomCategories(Long roomId) {
        roomAuthorizationService.requireMember(roomId);
        Room room = roomRepository.findByRoomIdForUpdate(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
        List<ExpenseCategory> categories =
                categoryRepository.findAllByRoom_RoomIdOrderByCategoryName(
                        roomId
                );
        if (!categories.isEmpty()) {
            return categories;
        }

        // Initialize rooms created before category setup; the room lock prevents duplicate seeds.
        List<ExpenseCategory> defaults = DEFAULT_CATEGORIES.stream()
                .map(name -> {
                    ExpenseCategory category = new ExpenseCategory();
                    category.setRoom(room);
                    category.setCategoryName(name);
                    return category;
                })
                .toList();
        return categoryRepository.saveAll(defaults);
    }
}
