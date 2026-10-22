package com.splitroom.backend.service;

import com.splitroom.backend.dto.request.LoginRequest;
import com.splitroom.backend.dto.request.RegisterRequest;
import com.splitroom.backend.dto.response.AuthResponse;
import com.splitroom.backend.dto.response.UserResponse;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.repository.UserRepository;
import com.splitroom.backend.security.JwtTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenService jwtTokenService;

    @Transactional
    public UserResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        String phone = request.getPhone().trim();
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("An account with this email already exists");
        }
        if (userRepository.existsByPhone(phone)) {
            throw new ConflictException("An account with this phone already exists");
        }

        User user = new User();
        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setPhone(phone);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(UserRole.MEMBER);

        return toResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(
                        email,
                        request.getPassword()
                )
        );
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException(
                        "Invalid email or password"
                ));
        return new AuthResponse(
                "Bearer",
                jwtTokenService.createToken(user),
                jwtTokenService.getExpirationSeconds(),
                toResponse(user)
        );
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
