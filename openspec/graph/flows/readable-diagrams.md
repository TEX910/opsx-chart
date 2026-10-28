<!-- opsx-chart:generated v1 -->
# readable-diagrams

**Current view:** derived from the current OpenSpec specifications.

Generated for reading. Change the specification and regenerate this view.

## Sources

- [openspec/specs/readable-diagrams/spec.md](../../specs/readable-diagrams/spec.md)

## Represent every selected scenario

### Multiple cases in a requirement

```mermaid
flowchart LR
    condition["WHEN A requirement has multiple scenarios"] --> outcome["THEN Share related conditions and trace every case, preserving guards/results and leaving ambiguous cases separate"]
```

### Positive and negative cases

```mermaid
flowchart LR
    condition["WHEN Two scenarios describe positive and negative cases of the same check"] --> outcome["THEN Draw that check once with guarded positive/negative branches"]
```

### Shared graph introduces extra routes

```mermaid
flowchart LR
    condition["WHEN Sharing nodes creates an undeclared root-to-result route"] --> outcome["THEN Report the unsupported scenario route before writing diagrams"]
```

### Changed requirement

```mermaid
flowchart LR
    condition["WHEN A selected delta modifies a current requirement"] --> outcome["THEN Show its complete proposed cases; preserve current views until specs change"]
```

### Incomplete coverage

```mermaid
flowchart LR
    condition["WHEN A rendering model omits a scenario or invents another"] --> outcome["THEN Report the coverage error before writing diagrams"]
```

## Show evidenced capability relationships

### Inferred association

```mermaid
flowchart LR
    condition["WHEN An association is interpreted without an explicit dependency contract"] --> outcome["THEN Use a dotted evidenced related-to edge; infer no typed dependency"]
```

## Preserve source and output ownership

### Source changed during generation

```mermaid
flowchart LR
    condition["WHEN Specs change after the generation snapshot"] --> outcome["THEN Stop rendering and request a fresh snapshot"]
```

### Hand-edited drawing

```mermaid
flowchart LR
    condition["WHEN A generated view was manually modified"] --> outcome["THEN Preserve it and report the conflict"]
```

### Archived proposal

```mermaid
flowchart LR
    condition["WHEN OpenSpec archives a change containing generated views"] --> outcome["THEN Rebase links and retain history; compare archived delta/outputs rather than today’s base specs"]
```
