## Why
Locked accounts must not create sessions, and the member needs a security notice explaining the attempted sign-in.

## What Changes
- Add the locked-account sign-in case while preserving existing valid/invalid credential cases.
- Generate read-only Mermaid views of the affected specification for review.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `authentication`: deny a locked account and request a security notice.

## Impact
Authentication behavior and its call to notifications are affected. The proposed views belong to this change; canonical behavior remains unchanged until normal OpenSpec sync.
