package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.LoginRequest;
import com.splitroom.backend.dto.request.RegisterRequest;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.repository.UserRepository;
import com.splitroom.backend.security.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

class AuthServiceTests {

    @Test
    void duplicateEmailRegistrationIsRejectedBeforePasswordHashing() {
        UserRepository repository = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AuthenticationManager authenticationManager =
                mock(AuthenticationManager.class);
        JwtTokenService tokenService = mock(JwtTokenService.class);
        RegisterRequest request = new RegisterRequest();
        request.setName("Jordan");
        request.setEmail("JORDAN@example.com");
        request.setPhone("9876543210");
        request.setPassword("StrongPassword123");
        when(repository.existsByEmail("jordan@example.com")).thenReturn(true);

        AuthService service = new AuthService(
                repository,
                encoder,
                authenticationManager,
                tokenService
        );

        ConflictException error = org.junit.jupiter.api.Assertions.assertThrows(
                ConflictException.class,
                () -> service.register(request)
        );

        assertEquals("An account with this email already exists", error.getMessage());
        verify(encoder, never()).encode(any());
        verify(repository, never()).save(any(User.class));
    }

    @Test
    void loginPropagatesGenericBadCredentialsForUnknownOrIncorrectCredentials() {
        UserRepository repository = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AuthenticationManager authenticationManager =
                mock(AuthenticationManager.class);
        JwtTokenService tokenService = mock(JwtTokenService.class);
        LoginRequest request = new LoginRequest();
        request.setEmail("missing@example.com");
        request.setPassword("incorrect-password");
        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        AuthService service = new AuthService(
                repository,
                encoder,
                authenticationManager,
                tokenService
        );

        org.junit.jupiter.api.Assertions.assertThrows(
                BadCredentialsException.class,
                () -> service.login(request)
        );
        verify(repository, never()).findByEmail("missing@example.com");
    }

    @Test
    void registrationHashesPasswordAndDoesNotExposeIt() {
        UserRepository repository = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AuthenticationManager authenticationManager =
                mock(AuthenticationManager.class);
        JwtTokenService tokenService = mock(JwtTokenService.class);
        RegisterRequest request = new RegisterRequest();
        request.setName(" Narayan ");
        request.setEmail("NARAYAN@example.com");
        request.setPhone("9876543210");
        request.setPassword("StrongPassword123");

        when(repository.existsByEmail("narayan@example.com"))
                .thenReturn(false);
        when(repository.existsByPhone("9876543210")).thenReturn(false);
        when(encoder.encode("StrongPassword123")).thenReturn("$2a$hash");
        when(repository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setUserId(1L);
            return user;
        });

        AuthService service = new AuthService(
                repository,
                encoder,
                authenticationManager,
                tokenService
        );
        var response = service.register(request);

        assertEquals("Narayan", response.name());
        assertEquals("narayan@example.com", response.email());
        verify(encoder).encode("StrongPassword123");
        verify(repository).save(org.mockito.ArgumentMatchers.argThat(
                user -> user.getRole() == UserRole.MEMBER
                        && "$2a$hash".equals(user.getPassword())
        ));
    }

    @Test
    void loginReturnsJwtAndSafeUserDetails() {
        UserRepository repository = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AuthenticationManager authenticationManager =
                mock(AuthenticationManager.class);
        JwtTokenService tokenService = mock(JwtTokenService.class);
        User user = new User();
        user.setUserId(8L);
        user.setName("Narayan");
        user.setEmail("narayan@example.com");
        user.setPassword("$2a$hash");

        LoginRequest request = new LoginRequest();
        request.setEmail("NARAYAN@example.com");
        request.setPassword("StrongPassword123");

        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "narayan@example.com",
                        null,
                        java.util.List.of()
                );
        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(authentication);
        when(repository.findByEmail("narayan@example.com"))
                .thenReturn(Optional.of(user));
        when(tokenService.createToken(user)).thenReturn("signed.jwt.value");
        when(tokenService.getExpirationSeconds()).thenReturn(3600L);

        AuthService service = new AuthService(
                repository,
                encoder,
                authenticationManager,
                tokenService
        );
        var response = service.login(request);

        assertEquals("Bearer", response.tokenType());
        assertEquals("signed.jwt.value", response.accessToken());
        assertEquals(8L, response.user().userId());
        assertEquals(3600L, response.expiresInSeconds());
    }
}
