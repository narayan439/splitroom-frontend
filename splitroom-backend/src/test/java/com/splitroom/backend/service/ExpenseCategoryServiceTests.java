package com.splitroom.backend.service;

import com.splitroom.backend.entity.ExpenseCategory;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.repository.ExpenseCategoryRepository;
import com.splitroom.backend.repository.RoomRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExpenseCategoryServiceTests {

    @Test
    void returnsExistingCategoriesOnlyToRoomMembers() {
        Room room = new Room();
        room.setRoomId(12L);
        ExpenseCategoryRepository categoryRepository =
                mock(ExpenseCategoryRepository.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        RoomAuthorizationService authorization =
                mock(RoomAuthorizationService.class);
        when(roomRepository.findByRoomIdForUpdate(12L))
                .thenReturn(Optional.of(room));
        when(categoryRepository
                .findAllByRoom_RoomIdOrderByCategoryName(12L))
                .thenReturn(List.of());
        when(categoryRepository.saveAll(anyList()))
                .thenAnswer(invocation -> {
                    return invocation.<List<ExpenseCategory>>getArgument(0);
                });

        ExpenseCategoryService service = new ExpenseCategoryService(
                categoryRepository,
                roomRepository,
                authorization
        );

        List<ExpenseCategory> result = service.getRoomCategories(12L);

        assertEquals(
                List.of("Rent", "Electricity", "Groceries", "Water", "Other"),
                result.stream().map(ExpenseCategory::getCategoryName).toList()
        );
        assertEquals(
                List.of(room, room, room, room, room),
                result.stream().map(ExpenseCategory::getRoom).toList()
        );
        verify(authorization).requireMember(12L);
    }

    @Test
    void doesNotDuplicateExistingRoomCategories() {
        Room room = new Room();
        room.setRoomId(12L);
        ExpenseCategory savedCategory = new ExpenseCategory();
        savedCategory.setRoom(room);
        savedCategory.setCategoryName("Custom");
        ExpenseCategoryRepository categoryRepository =
                mock(ExpenseCategoryRepository.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        RoomAuthorizationService authorization =
                mock(RoomAuthorizationService.class);
        when(roomRepository.findByRoomIdForUpdate(12L))
                .thenReturn(Optional.of(room));
        when(categoryRepository
                .findAllByRoom_RoomIdOrderByCategoryName(12L))
                .thenReturn(List.of(savedCategory));

        ExpenseCategoryService service = new ExpenseCategoryService(
                categoryRepository,
                roomRepository,
                authorization
        );

        assertEquals(
                List.of(savedCategory),
                service.getRoomCategories(12L)
        );
        verify(categoryRepository, org.mockito.Mockito.never())
                .saveAll(anyList());
    }
}
