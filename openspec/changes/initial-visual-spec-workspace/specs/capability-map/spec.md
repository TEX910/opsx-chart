# Spec Delta

## Purpose

Let a developer see and edit declared relationships among OpenSpec capabilities, while keeping inferred connections visibly separate from confirmed relationships.

## ADDED Requirements

### Requirement: Display the capability map
The system SHALL show every current capability as a navigable node and display its declared relationships as labeled, directed edges.

#### Scenario: Navigate from a capability
- **WHEN** a user selects a capability node
- **THEN** the system shows that capability's purpose and a link to its OpenSpec specification
- **AND** the system highlights its incoming and outgoing relationships

### Requirement: Edit typed relationships
The system SHALL let a user add and remove directed relationships of supported types between existing capabilities and persist them in versioned graph files.

#### Scenario: Add a dependency
- **WHEN** a user declares that capability A depends on capability B
- **THEN** the map displays a directed `depends-on` edge from A to B
- **AND** the relationship remains after the project is reopened

#### Scenario: Remove a relationship
- **WHEN** a user removes an existing relationship
- **THEN** the edge disappears from the map and the versioned graph data
- **AND** neither capability's normative specification is changed

### Requirement: Reject invalid relationships
The system SHALL reject relationships with unresolved endpoints, self-dependencies, or cycles formed by `depends-on` edges and explain the problem before saving.

#### Scenario: Dependency cycle attempted
- **WHEN** a new `depends-on` edge would form a cycle
- **THEN** the system refuses the edge and identifies the cycle

#### Scenario: Capability no longer exists
- **WHEN** a saved relationship points to a missing capability
- **THEN** validation reports the unresolved capability reference

### Requirement: Keep inferred relationships distinct
The system SHALL label relationships inferred from change history or shared references as suggestions until a user explicitly confirms them.

#### Scenario: Capabilities changed together
- **WHEN** two capabilities occur in the same change without a declared relationship
- **THEN** the system may suggest a connection
- **AND** it does not persist the suggestion as a confirmed relationship
