package com.splitroom.backend.service;

import com.splitroom.backend.entity.User;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public User getRequiredUser() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ForbiddenException(
                    "An authenticated application user is required"
            );
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ForbiddenException(
                        "The authenticated principal is not linked to a SplitRoom user"
                ));
    }
}
