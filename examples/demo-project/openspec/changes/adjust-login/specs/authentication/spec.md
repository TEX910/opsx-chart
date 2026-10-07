## MODIFIED Requirements

### Requirement: Sign in
The system SHALL authenticate a member with valid credentials and reject a locked account.

#### Scenario: Valid credentials
- **WHEN** a member submits valid credentials
- **AND** the member's account is not locked
- **THEN** the system starts a session

#### Scenario: Invalid credentials
- **WHEN** a member submits invalid credentials
- **THEN** the system denies access

#### Scenario: Locked account
- **WHEN** a member submits valid credentials
- **AND** the member's account is locked
- **THEN** the system denies access and explains the lock
