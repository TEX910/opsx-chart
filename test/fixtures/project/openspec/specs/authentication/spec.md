# Authentication Specification

## Purpose
Allow a member to sign in with a password.

## Requirements

### Requirement: Sign in
The system SHALL authenticate a member with valid credentials.

#### Scenario: Valid credentials
- **WHEN** a member submits valid credentials
- **THEN** the system starts a session

#### Scenario: Invalid credentials
- **WHEN** a member submits invalid credentials
- **THEN** the system denies access
