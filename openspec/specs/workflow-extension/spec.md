# Workflow Extension Specification

## Purpose
Extend installed OpenSpec workflows with readable graphical documentation while preserving their phase boundaries and behavior ownership.

## Requirements

### Requirement: Compose the original operation
The suite SHALL provide a distinct skill entry point for each supported installed OpenSpec operation and follow the actual original skill with the same change, schema, selected store and stopping conditions.

#### Scenario: Planning writes specifications
- **WHEN** the original planning operation writes spec artifacts
- **THEN** the wrapper generates their proposed views through readable-diagrams
- **AND** it stops before implementation

#### Scenario: Original skill is unavailable
- **WHEN** a requested wrapper cannot find its original skill
- **THEN** it reports the missing dependency without reconstructing the workflow

#### Scenario: Read-only operation
- **WHEN** the user explores or verifies without requesting persistent capture
- **THEN** the wrapper reads or checks views without writing diagrams

### Requirement: Install alongside existing skills
The installer SHALL add self-contained Chart skills only for installed originals and preserve original skills, project configuration and local skill edits.

#### Scenario: Core profile
- **WHEN** six core OpenSpec operations are installed
- **THEN** Chart installs their six wrappers and one shared diagram skill

#### Scenario: Modified installation
- **WHEN** a Chart skill differs from its managed installation receipt
- **THEN** an update reports the conflict and preserves the edited file

### Requirement: Respect current and historical scope
The suite SHALL keep proposed, current and archived views distinct and report native-operation and diagram outcomes separately.

#### Scenario: Archive without synchronization
- **WHEN** the original operation archives a change without syncing its specs
- **THEN** the proposed view remains historical in the archive
- **AND** current views describe only the canonical specs on disk

#### Scenario: Diagram generation fails after native success
- **WHEN** the original operation succeeds but its diagram refresh fails
- **THEN** the wrapper reports both outcomes and the documentation scope to repair
- **AND** it does not repeat the completed native operation
