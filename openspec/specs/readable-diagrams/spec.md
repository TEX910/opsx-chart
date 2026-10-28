# Readable Diagrams Specification

## Purpose
Represent specifications and their conditions/results as derived Mermaid reading views, without introducing a second editable behavior model.

## Requirements

### Requirement: Represent every selected scenario
The suite SHALL conceptualize the effective scenarios of selected specs as Mermaid graphs, sharing logically related conditions, decisions and equivalent results while preserving a trace to every source scenario.

#### Scenario: Multiple cases in a requirement
- **WHEN** a requirement contains several scenarios
- **THEN** logically related scenarios share condition or decision nodes with labeled branches
- **AND** each scenario retains its preconditions, full result and traced graph path
- **AND** unrelated or ambiguously overlapping cases remain separate without an invented execution order or priority

#### Scenario: Positive and negative cases
- **WHEN** two scenarios describe positive and negative cases of the same logical check
- **THEN** the graph represents that check once with its corresponding branches
- **AND** any additional precondition is preserved as a guard on the appropriate branch

#### Scenario: Shared graph introduces extra routes
- **WHEN** joining and splitting shared nodes creates a root-to-result route absent from the declared source-scenario paths
- **THEN** rendering reports the unsupported route before writing diagrams

#### Scenario: Changed requirement
- **WHEN** a selected delta modifies a current requirement
- **THEN** the proposed view includes its complete effective scenario set
- **AND** current diagrams remain unchanged until canonical specs actually change

#### Scenario: Incomplete coverage
- **WHEN** a rendering model omits a selected scenario or invents another
- **THEN** the renderer reports the coverage error before writing diagrams

### Requirement: Show evidenced capability relationships
The map SHALL show relationships with source evidence and distinguish inferred associations from explicitly documented dependencies.

#### Scenario: Inferred association
- **WHEN** an agent interprets an association without an explicit dependency contract
- **THEN** it may show a dotted related-to connection with its source evidence
- **AND** it does not show an inferred typed dependency

### Requirement: Preserve source and output ownership
Rendering SHALL leave specs unchanged, replace only its own unedited outputs and detect stale views from source content or inventory changes.

#### Scenario: Source changed during generation
- **WHEN** specs change after the generation snapshot
- **THEN** rendering stops and requests a fresh snapshot

#### Scenario: Hand-edited drawing
- **WHEN** a generated diagram was manually modified
- **THEN** regeneration preserves it and reports the conflict

#### Scenario: Archived proposal
- **WHEN** OpenSpec moves a change with generated views to its archive
- **THEN** the suite rebases the source links and retains a historical preview
- **AND** historical checks compare the archived delta and outputs without requiring today's base specs to match
