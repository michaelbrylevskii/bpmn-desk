package org.bpmndesk.runtimefixture;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

/** Самостоятельный тестовый сервер; не включается в приложение. */
@SpringBootApplication
public class FixtureApplication {
    public static void main(String[] args) { SpringApplication.run(FixtureApplication.class, args); }
    @Bean
    InMemoryUserDetailsManager users() {
        return new InMemoryUserDetailsManager(User.withUsername("desk-reader").password("{noop}fixture-password").roles("REST").build());
    }
    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(auth -> auth.requestMatchers(PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.GET, "/process-api/**")).authenticated().anyRequest().denyAll())
                .httpBasic(Customizer.withDefaults()).build();
    }
}
