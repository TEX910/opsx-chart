# Spec Delta

## Purpose

Let a developer describe a capability's operational paths as an editable graph and inspect the OpenSpec scenarios that give those paths their normative meaning.

## ADDED Requirements

### Requirement: Maintain multiple flows for one capability
The system SHALL let a user create, reopen, rename, and delete more than one behavioral flow for a capability, with each flow stored in a versioned graph file.

#### Scenario: Create a second flow
- **WHEN** a capability already has a login flow and the user creates a recovery flow
- **THEN** both flows remain separately selectable under that capability

### Requirement: Edit flow topology
The system SHALL let a user add, connect, label, move, and remove event, action, decision, and outcome nodes, including labeled branches and paths that revisit a node.

#### Scenario: Draw success and failure paths
- **WHEN** a user connects a decision to success and failure outcomes
- **THEN** both labeled paths are visible and persist after reopening

#### Scenario: Reposition a node
- **WHEN** a user moves a node without changing its meaning or connections
- **THEN** only graph presentation data changes
- **AND** no OpenSpec requirement or scenario update is proposed

### Requirement: Link paths to OpenSpec scenarios
The system SHALL let a user link a path through a flow to a requirement and scenario in the same capability and navigate in either direction between them.

#### Scenario: Select a linked path
- **WHEN** a user selects a path linked to a scenario
- **THEN** the workspace shows the scenario's current or proposed text and its source file

#### Scenario: Select a linked scenario
- **WHEN** a user selects a scenario with one or more linked paths
- **THEN** the workspace highlights those paths in the flow

### Requirement: Preserve distinct ownership of text and topology
The system SHALL treat OpenSpec requirement and scenario text as the normative behavior contract and graph files as the topology, path links, and layout of that behavior.

#### Scenario: OpenSpec project has no graph data
- **WHEN** a user opens a valid OpenSpec capability without flow files
- **THEN** its specification remains readable
- **AND** the user can create a flow without rewriting the specification

### Requirement: Diagnose incomplete flows
The system SHALL report unreachable nodes, unlabeled decision branches, and broken scenario links without silently inventing missing behavior.

#### Scenario: Decision branch has no label
- **WHEN** a user saves a decision with an unlabeled outgoing branch
- **THEN** flow validation identifies that branch for correction
