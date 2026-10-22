package com.splitroom.backend.config;

import com.splitroom.backend.security.JwtAuthenticationEntryPoint;
import com.splitroom.backend.security.JwtAuthenticationFilter;
import com.splitroom.backend.security.SplitRoomUserDetailsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration configuration
    ) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            JwtAuthenticationEntryPoint authenticationEntryPoint,
            PasswordEncoder passwordEncoder,
            SplitRoomUserDetailsService userDetailsService,
            @Value("${app.swagger.enabled:false}") boolean swaggerEnabled
    ) throws Exception {
        http
                // Authentication uses Authorization: Bearer only, never cookies.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {
                })
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                )
                .authorizeHttpRequests(authorize -> {
                    authorize.requestMatchers("/healthz").permitAll();
                    authorize.requestMatchers(
                            HttpMethod.POST,
                            "/api/auth/register",
                            "/api/auth/login"
                    ).permitAll();
                    if (swaggerEnabled) {
                        authorize.requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**"
                        ).permitAll();
                    }
                    authorize.anyRequest().authenticated();
                })
                .authenticationProvider(authenticationProvider(
                        userDetailsService,
                        passwordEncoder
                ))
                .addFilterBefore(
                        jwtAuthenticationFilter,

                        UsernamePasswordAuthenticationFilter.class
                )
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable());
        return http.build();
    }

    @Bean
    public org.springframework.security.authentication.dao.DaoAuthenticationProvider
    authenticationProvider(
            SplitRoomUserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        var provider =
                new org.springframework.security.authentication.dao.DaoAuthenticationProvider(
                        userDetailsService
                );
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }
}
