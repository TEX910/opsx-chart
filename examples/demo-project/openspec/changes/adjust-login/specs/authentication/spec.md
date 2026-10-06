## MODIFIED Requirements

### Requirement: Sign in
The system SHALL authenticate a member with valid credentials and reject a locked account.

#### Scenario: Valid credentials
- **WHEN** a member submits valid credentials
- **THEN** the system starts a session

#### Scenario: Invalid credentials
- **WHEN** a member submits invalid credentials
- **THEN** the system denies access

#### Scenario: Locked account
- **WHEN** a locked member submits credentials
- **THEN** the system denies access and explains the lock
