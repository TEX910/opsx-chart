# Spec Delta

## Purpose

Let a developer open one local OpenSpec project and inspect its capabilities and change proposals without altering the project merely by browsing it.

## ADDED Requirements

### Requirement: Open a local OpenSpec project
The workspace SHALL open a selected local directory containing an OpenSpec root and report a clear error when the root or required OpenSpec CLI is unavailable.

#### Scenario: Valid project opens
- **WHEN** a user selects a local directory containing an OpenSpec project
- **THEN** the workspace displays the resolved project root and its capabilities

#### Scenario: Invalid project is rejected
- **WHEN** a user selects a directory without a usable OpenSpec root
- **THEN** the workspace explains why it cannot open the project
- **AND** the workspace does not create or modify project files

### Requirement: Distinguish current specifications from proposed changes
The workspace SHALL display canonical capabilities separately from active change proposals and identify which capabilities each proposal adds or modifies.

#### Scenario: Existing capability has a proposed modification
- **WHEN** an active change contains a delta for an existing capability
- **THEN** the workspace labels the canonical spec as current and the delta as proposed

#### Scenario: New capability exists only in a change
- **WHEN** an active change proposes a capability absent from the canonical specs
- **THEN** the workspace displays it as proposed rather than as current behavior

### Requirement: Refresh after external edits
The workspace SHALL refresh its displayed content after OpenSpec files change outside the application without discarding unsaved graph edits.

#### Scenario: Spec edited in a text editor
- **WHEN** a user edits a displayed spec in another editor
- **THEN** the workspace reloads its content or offers a visible refresh
- **AND** any unsaved graph edits remain available for review
