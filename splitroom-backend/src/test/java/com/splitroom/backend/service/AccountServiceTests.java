package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.ChangePasswordRequest;
import com.splitroom.backend.dto.request.UpdateProfileRequest;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.repository.UserRepository;
import com.splitroom.backend.security.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountServiceTests {

    @Test
    void profileUpdateNormalizesEmailAndReturnsRefreshedSession() {
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        UserRepository userRepository = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtTokenService jwtTokenService = mock(JwtTokenService.class);
        User user = new User();
        user.setUserId(9L);
        user.setName("Old Name");
        user.setEmail("old@example.com");
        user.setPhone("9876543210");
        when(currentUserService.getRequiredUser()).thenReturn(user);
        when(userRepository.existsByEmailAndUserIdNot("new@example.com", 9L))
                .thenReturn(false);
        when(userRepository.existsByPhoneAndUserIdNot("9876543211", 9L))
                .thenReturn(false);
        when(userRepository.save(user)).thenReturn(user);
        when(jwtTokenService.createToken(user)).thenReturn("refreshed.jwt");
        when(jwtTokenService.getExpirationSeconds()).thenReturn(3600L);

        AccountService service = new AccountService(
                currentUserService,
                userRepository,
                passwordEncoder,
                jwtTokenService
        );

        var response = service.updateProfile(new UpdateProfileRequest(
                " New Name ",
                "NEW@example.com",
                "9876543211"
        ));

        assertEquals("New Name", response.user().name());
        assertEquals("new@example.com", response.user().email());
        assertEquals("9876543211", response.user().phone());
        assertEquals("refreshed.jwt", response.accessToken());
        verify(userRepository).save(user);
    }

    @Test
    void passwordChangeRequiresCurrentPasswordToMatch() {
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        UserRepository userRepository = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtTokenService jwtTokenService = mock(JwtTokenService.class);
        User user = new User();
        user.setPassword("encoded-current");
        when(currentUserService.getRequiredUser()).thenReturn(user);
        when(passwordEncoder.matches("wrong", "encoded-current")).thenReturn(false);

        AccountService service = new AccountService(
                currentUserService,
                userRepository,
                passwordEncoder,
                jwtTokenService
        );

        assertThrows(
                ForbiddenException.class,
                () -> service.changePassword(new ChangePasswordRequest(
                        "wrong",
                        "new-password"
                ))
        );
        verify(passwordEncoder, never()).encode(any());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void passwordChangeStoresOnlyTheEncodedNewPassword() {
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        UserRepository userRepository = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtTokenService jwtTokenService = mock(JwtTokenService.class);
        User user = new User();
        user.setPassword("encoded-current");
        when(currentUserService.getRequiredUser()).thenReturn(user);
        when(passwordEncoder.matches("current", "encoded-current")).thenReturn(true);
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-new");

        AccountService service = new AccountService(
                currentUserService,
                userRepository,
                passwordEncoder,
                jwtTokenService
        );
        service.changePassword(new ChangePasswordRequest("current", "new-password"));

        assertEquals("encoded-new", user.getPassword());
        verify(userRepository).save(user);
    }
}
