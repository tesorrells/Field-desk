# Federation completion roadmap

Goal: practical, selective collaboration between separate local Field Desk instances.

## Implementation stages

- [x] Signed corrections and withdrawals: retain history, show reasons/dates, warn on affected references, preserve author and pairwise scope.
- [x] Sharing permissions: per-contact incoming/outgoing scopes, reciprocity, explicit previewed scope replacement.
- [x] Onboarding and compatibility: guided setup, connection checks, supported-content negotiation and actionable upgrade messages.
- [x] Identity backup and recovery: protected migration backup, controlled identity replacement, no silent trusted-key reset.
- [x] Scale and daily use: search, filters, bulk review, capacity indicators, larger local storage and bounded incremental exchange.

Each stage needs focused automated checks, migration/backup coverage where relevant, documentation and mirroring into the clean public checkout. Explicit selection, review, saving and pairwise no-forwarding remain requirements.

## User-run acceptance test

The user will test two actual computers on separate networks. This is outside the implementation goal. Exercise setup, exchange and review, restart, reconnect, revocation and three-person isolation. Local/simulated tests cannot establish actual household connectivity.

## Release

Commit, push and hosted deployment require a separate request. The public tool stays clone-and-run with local storage; federation does not expose the main app.

Validated the first three stages with focused lifecycle/capability/permissions checks, existing three-instance/contact/inbox regressions, public TypeScript and browser checks using synthetic data. The remote household test remains user-run.

Recovery validated with encrypted synthetic kits, exact key/scope migration, lost-key/new-ID recovery, retirement and signature regressions; interactive terminal backup/restore also tested with hidden synthetic passphrase entry.

All five stages are implemented. See [validation and the manual remote checklist](FEDERATION_VALIDATION.md). The remote acceptance test remains user-run.
