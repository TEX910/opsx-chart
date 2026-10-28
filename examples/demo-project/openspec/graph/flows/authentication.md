<!-- opsx-chart:generated v1 -->
# authentication

**Current view:** derived from the current OpenSpec specifications.

Generated for reading. Change the specification and regenerate this view.

## Sources

- [openspec/specs/authentication/spec.md](../../specs/authentication/spec.md)

## Sign in

### Credential check

```mermaid
flowchart LR
    node0{"Credentials valid?"}
    node1["THEN Start a session and request a sign-in notice"]
    node2["THEN Deny access"]
    node0 -->|"Yes · active member"| node1
    node0 -->|"No"| node2
```

| Source scenario | WHEN conditions |
| --- | --- |
| Valid credentials | An active member supplies valid credentials |
| Invalid credentials | A member supplies invalid credentials |
