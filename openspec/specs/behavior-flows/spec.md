# behavior-flows Specification

## Purpose

Let a developer describe one capability's operational behavior as an editable graph while reading the OpenSpec scenarios that define its normative meaning.

## Requirements

### Requirement: Maintain one flow for each capability
The system SHALL present one behavioral flow per capability and SHALL save behavioral edits as a draft in the selected OpenSpec change.

#### Scenario: Edit an existing flow in a change
- **WHEN** a user selects a capability and an active change
- **THEN** the workspace opens that capability's single flow and saves behavioral edits as a draft for the change

#### Scenario: Legacy capability has multiple flows
- **WHEN** a capability has several older canonical flows
- **THEN** the workspace offers to combine them into one flow while backing up the originals

### Requirement: Edit flow topology and node behavior
The system SHALL let a user add, connect, rename, move, and remove Event, Action, Decision, and Outcome nodes. A Decision SHALL store a WHEN for each outgoing branch, and an Outcome SHALL store its THEN.

#### Scenario: Draw decision paths
- **WHEN** a user connects a Decision to Actions, further Decisions, or Outcomes
- **THEN** each outgoing branch can carry its own WHEN and every complete route ends at an Outcome with a THEN

#### Scenario: Connect an Action to an Outcome
- **WHEN** a user connects an Action to an Outcome
- **THEN** the route includes that Action without adding another WHEN

#### Scenario: Reposition a node
- **WHEN** a user moves a node without changing its meaning or connections
- **THEN** only graph presentation data changes
- **AND** no OpenSpec requirement or scenario update is proposed

### Requirement: Display graph paths beside OpenSpec scenarios
The system SHALL show complete Event-to-Outcome paths and their scenario links read only in the application. A skill SHALL maintain path associations and reconcile node WHEN and THEN text into the change's OpenSpec spec delta.

#### Scenario: Select a linked path
- **WHEN** a user selects a path linked to a scenario
- **THEN** the workspace shows the scenario's current or proposed text and highlights the path

#### Scenario: Path lacks a scenario link
- **WHEN** a complete graph path is not linked to an OpenSpec scenario
- **THEN** the workspace lists it as awaiting reconciliation and directs the user to the graph-to-spec skill

### Requirement: Preserve distinct ownership of text and topology
The system SHALL treat OpenSpec requirement and scenario text as the normative behavior contract and graph files as the topology, node behavior drafts, path links, and layout.

#### Scenario: OpenSpec project has no graph data
- **WHEN** a user opens a valid OpenSpec capability without flow files
- **THEN** its specification remains readable
- **AND** the user can create a flow after selecting an active change without rewriting the specification

### Requirement: Diagnose incomplete flows
The system SHALL report unreachable nodes, missing Decision WHENs or Outcome THENs, incomplete case paths, and broken scenario links without inventing missing behavior.

#### Scenario: Decision branch has no WHEN
- **WHEN** a user saves a Decision with an outgoing branch that has no WHEN
- **THEN** flow validation identifies that branch for correction
