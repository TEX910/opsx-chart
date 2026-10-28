## Context
The current authentication spec has successful and invalid-credential scenarios. This example adds the locked-account case and a graphical reading view.

## Decisions
- Keep the authentication delta as the behavior contract.
- Use the existing notifications capability for the notice.
- Share the credential check across valid/invalid scenarios, preserving the active-member guard on its positive branch.
- Retain the locked-account case separately because its overlap with invalid credentials has no specified priority; the drawing is not an executable login algorithm.
- Preserve current views until the spec is synced by OpenSpec.

## Validation
Check the OpenSpec delta, verify that all three proposed cases are represented, and compare the summaries to the source scenarios. This demo does not implement application code or sync its proposal.
