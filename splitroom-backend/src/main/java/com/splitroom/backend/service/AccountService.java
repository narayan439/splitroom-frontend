package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.ChangePasswordRequest;
import com.splitroom.backend.dto.request.UpdateProfileRequest;
import com.splitroom.backend.dto.response.AuthResponse;
import com.splitroom.backend.dto.response.UserResponse;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.repository.UserRepository;
import com.splitroom.backend.security.JwtTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    @Transactional
    public AuthResponse updateProfile(UpdateProfileRequest request) {
        User user = currentUserService.getRequiredUser();
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String phone = request.phone().trim();
        if (userRepository.existsByEmailAndUserIdNot(email, user.getUserId())) {
            throw new ConflictException("An account with this email already exists");
        }
        if (userRepository.existsByPhoneAndUserIdNot(phone, user.getUserId())) {
            throw new ConflictException("An account with this phone already exists");
        }

        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPhone(phone);
        User updatedUser = userRepository.save(user);
        return new AuthResponse(
                "Bearer",
                jwtTokenService.createToken(updatedUser),
                jwtTokenService.getExpirationSeconds(),
                toResponse(updatedUser)
        );
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        User user = currentUserService.getRequiredUser();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ForbiddenException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getUserId(),
                user.getName(),
                user.getEmail(),
                user.getPhone()
        );
    }
}
