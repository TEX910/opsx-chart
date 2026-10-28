<!-- opsx-chart:generated v1 -->
# workflow-extension

**Current view:** derived from the current OpenSpec specifications.

Generated for reading. Change the specification and regenerate this view.

## Sources

- [openspec/specs/workflow-extension/spec.md](../../specs/workflow-extension/spec.md)

## Compose the original operation

### Planning writes specifications

```mermaid
flowchart LR
    condition["WHEN Planning writes spec artifacts"] --> outcome["THEN Generate proposed views and stop before implementation"]
```

### Original skill is unavailable

```mermaid
flowchart LR
    condition["WHEN The original skill is unavailable"] --> outcome["THEN Report the missing dependency without reconstructing its workflow"]
```

### Read-only operation

```mermaid
flowchart LR
    condition["WHEN Explore or verify runs without a persistent capture request"] --> outcome["THEN Read or check views without writing diagrams"]
```

## Install alongside existing skills

### Core profile

```mermaid
flowchart LR
    condition["WHEN Six core OpenSpec operations are installed"] --> outcome["THEN Install their six Chart wrappers and one shared diagram skill"]
```

### Modified installation

```mermaid
flowchart LR
    condition["WHEN An installed Chart skill differs from its receipt"] --> outcome["THEN Preserve the edited file and report the update conflict"]
```

## Respect current and historical scope

### Archive without synchronization

```mermaid
flowchart LR
    condition["WHEN The original archives a change without spec sync"] --> outcome["THEN Keep its proposal historical; current views use canonical specs on disk"]
```

### Diagram generation fails after native success

```mermaid
flowchart LR
    condition["WHEN The native operation succeeds but diagram refresh fails"] --> outcome["THEN Report both outcomes and the repair scope; do not repeat the operation"]
```
