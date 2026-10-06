# Design: locked-account sign-in

The current sign-in flow branches on credential validity. This change adds a locked-account check after valid credentials, with a separate denial outcome linked to the new OpenSpec scenario. The existing invalid-credentials path keeps its node and edge IDs. The flow stays in the change's graph directory until the delta spec is synced and graph reconciliation succeeds.
