# Authentication Specification

## Purpose
Allow an active member to sign in with a password.

## Requirements

### Requirement: Sign in
The system SHALL authenticate a member with valid credentials.
The system SHALL request sign-in notices from [notifications](../notifications/spec.md).

#### Scenario: Valid credentials
- **WHEN** an active member provides valid credentials
- **THEN** the system starts a session
- **AND** it requests a sign-in notice from notifications

#### Scenario: Invalid credentials
- **WHEN** a member provides invalid credentials
- **THEN** the system denies access
