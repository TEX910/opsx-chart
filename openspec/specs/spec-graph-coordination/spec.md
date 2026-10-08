# spec-graph-coordination Specification

## Purpose

Keep visual behavior drafts and OpenSpec scenario changes traceable through one change proposal, with explicit review when either representation changes.

## Requirements

### Requirement: Classify a graph edit before writing specifications
The system SHALL distinguish presentation-only edits from behavioral edits and SHALL require a selected active OpenSpec change before any graph edit.

#### Scenario: Layout edit needs no spec delta
- **WHEN** a user with an active change changes only node positions or viewport settings
- **THEN** the system saves the graph presentation without creating a spec delta

#### Scenario: No change selected
- **WHEN** a user has not selected an active OpenSpec change
- **THEN** the workspace does not allow graph, map, or relationship edits

#### Scenario: New branch needs a change proposal
- **WHEN** a user adds a branch representing a new outcome
- **THEN** the system associates that draft with a selected active OpenSpec change
- **AND** it shows the OpenSpec scenario that must be added or updated before completion

### Requirement: Prepare a paired change for behavior edits
For a behavioral graph edit, the system SHALL preserve the graph draft beside the change and show its OpenSpec delta read only. A skill SHALL reconcile complete paths into the delta; saving the graph SHALL NOT silently rewrite canonical or delta `spec.md`.

#### Scenario: New locked-account outcome
- **WHEN** a user adds a locked-account outcome to a login flow
- **THEN** the graph draft is saved in the active change
- **AND** the user can use the graph-to-spec skill to create or update the corresponding scenario delta

### Requirement: Detect changes to linked scenario text
The system SHALL detect when a linked requirement or scenario is renamed, removed, or textually changed outside the graph editor and mark the affected path for review.

#### Scenario: Scenario renamed in Markdown
- **WHEN** a linked scenario heading changes in an OpenSpec file
- **THEN** the system flags the old reference as unresolved
- **AND** it offers a candidate relink without silently applying it

#### Scenario: Scenario outcome edited in Markdown
- **WHEN** the text of a linked scenario changes while its heading stays the same
- **THEN** the system flags the linked path as potentially stale

### Requirement: Validate both representations before reconciliation
The system SHALL validate graph structure, graph references, and OpenSpec artifacts before presenting a change's graph draft as ready to reconcile.

#### Scenario: Graph path points to a missing scenario
- **WHEN** a graph draft refers to a scenario absent from the applicable current or delta spec
- **THEN** reconciliation is blocked with a diagnostic naming the missing reference

#### Scenario: OpenSpec validation fails
- **WHEN** OpenSpec reports an invalid change
- **THEN** the system does not mark the paired graph draft ready to reconcile

### Requirement: Preserve incomplete reconciliation for recovery
The system SHALL keep a graph draft discoverable and report incomplete reconciliation if OpenSpec specifications are synchronized or archived before the graph draft reaches canonical graph files.

#### Scenario: Native archive bypasses graph reconciliation
- **WHEN** a change containing a graph draft is archived directly with OpenSpec
- **THEN** the workspace reports the remaining graph draft and offers a reviewable recovery action

### Requirement: Support assistant guidance without making it authoritative
The system SHALL expose deterministic read, validate, and draft operations that assistant skills can use to reconcile scenario text from a path or propose a path update from scenario text; generated changes SHALL remain reviewable.

#### Scenario: Assistant drafts a scenario from a branch
- **WHEN** an assistant skill receives a new graph branch and its linked requirement context
- **THEN** it may propose OpenSpec scenario text
- **AND** the system validates the resulting files independently of the skill

#### Scenario: Assistant suggests a graph update from Markdown
- **WHEN** an assistant skill receives a changed OpenSpec scenario and its existing linked path
- **THEN** it may propose a graph patch
- **AND** the existing graph remains unchanged until that patch is accepted
