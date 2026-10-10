# Federation validation

Implementation audit completed 2026-10-09. All checks use synthetic local data and disposable identities.

| Stage | Implemented | Validation |
| --- | --- | --- |
| Author lifecycle | Signed corrections/withdrawals, retained history, affected-reference warnings | Lifecycle and broader-sharing fixtures; browser withdrawal filter |
| Permissions | Contact scopes, reciprocity, previewed replacement and old-grant revocation | Live permission/stale-preview/blocking tests and browser scope checks |
| Onboarding | Guided setup, signed capabilities, incompatible-content rejection | Capability fixtures, connection regressions and browser onboarding |
| Recovery | Encrypted kits, exact migration, deliberate new identity and retirement | Recovery/signature fixtures; interactive hidden-passphrase backup/restore with synthetic kits |
| Scale | Search, pagination, atomic bulk reviews, capacity, expanded limits, incremental signed batches | Scale fixtures; interrupted/restarted three-instance sync; browser 120-record study, selection across pages/search, exact two-target bulk review, explicit save and two signed preview batches |

The public checkout passes its complete offline `pnpm check` suite (37 check scripts), TypeScript and the local production build. The development checkout passes focused federation checks. Its existing Sites adapter has separate typing issues; the public checkout uses the local runtime. The production build retains the existing large-client-chunk warning. Browser validation found no console errors. A fresh local-only source export passed its artifact/privacy audit and included the identity command, local runtime and federation documentation.

Incremental testing includes 220 records in 100/100/20 batches, durable resume and unchanged pulls, complete changed-record history, signed inventory tamper rejection, and John/Sam/Tim isolation. Receiving data never automatically merges or saves it. Full histories and contact boundaries remain enforced before batching.

## Manual remote acceptance

The user will perform this test; it was intentionally excluded from the implementation goal:

1. Update two computers on separate networks, start the local app and Tailscale companions, independently compare fingerprints and exchange recipient-bound invitations in both directions.
2. Preview selected scope; receive, inspect, merge and explicitly save a contribution and dated review. Restart both instances and reconnect.
3. Correct/withdraw an origin contribution and inspect retained history, chosen revision and reference warnings.
4. Replace/revoke a scope and verify the old invitation fails; block a contact and confirm incoming/outgoing exchange stops.
5. With John connected to Sam and Tim, confirm Sam's contributions/reviews cannot reach Tim through John. Exercise interrupted sync and a full-scope recheck.

Local fixtures cannot establish actual household connectivity. Both companions must be online for transfer; there is no offline relay. This work is not an independent cryptographic security audit and does not add forward secrecy or encrypted live-key storage. Recovery cannot revoke a stolen key or copies already held on another machine.

The separate-network test is a remaining release validation step, not evidence supplied by the local automated checks. See [setup and recovery](LOCAL_SETUP.md#trusted-instance-sync) and [roadmap](FEDERATION_ROADMAP.md).
