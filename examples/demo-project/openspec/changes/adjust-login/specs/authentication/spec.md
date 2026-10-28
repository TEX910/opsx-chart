## MODIFIED Requirements

### Requirement: Sign in
The system SHALL authenticate a member with valid credentials when the member's account is not locked.
The system SHALL request sign-in notices from [notifications](../notifications/spec.md).
The system SHALL request a security notice from notifications after a locked-account sign-in attempt.

#### Scenario: Valid credentials
- **WHEN** an active member provides valid credentials
- **THEN** the system starts a session
- **AND** it requests a sign-in notice from notifications

#### Scenario: Invalid credentials
- **WHEN** a member provides invalid credentials
- **THEN** the system denies access

#### Scenario: Locked account
- **WHEN** a member with a locked account submits credentials
- **THEN** the system denies access and explains the account lock
- **AND** it requests a security notice from notifications
