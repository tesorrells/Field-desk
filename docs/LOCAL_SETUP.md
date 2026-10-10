# Local setup and maintenance

## Startup

Install Node 24+ and pnpm 11. Run `pnpm install --frozen-lockfile`, then `pnpm dev`; open http://127.0.0.1:5173. `pnpm dev 5174` changes the port. Both dev/start bind to 127.0.0.1. No database server, login, hosting account or Cloudflare configuration is required.

Local startup does not read `.dev.vars` or inject private starter locations. Set your locations in the app.

## Storage and recovery

First database use creates `.data/area-study.sqlite` and applies numbered SQL migrations. SQLite may also create WAL/SHM files. Applied migrations are hash-checked; restore the original file and add a new migration instead of editing one already used.

Use **Sources & reports → Backup & restore** to move/recover data. Complete backups include all locations, evidence, review history, routes and fixed briefings. Portfolio GeoJSON restores the study without adding archives. Restores retain existing reports and reject conflicting IDs/capacity overflow. Public-feed caches reload separately.

For a raw database copy, stop every server first and copy the whole `.data` directory. Do not copy only an active database while WAL writes are pending. Keep backups private and out of Git.

## Optional settings

Defaults work without environment files. Copy `.env.example` to `.env.local` only for overrides:

```dotenv
AREA_STUDY_DATA_DIR=.data
OSRM_BASE_URL=https://your-routing-service.example/routed-car
```

Relative storage paths are resolved from the checkout. Changing directories starts a separate database, not an automatic migration. A routing override must implement the HTTPS OSRM API. The default public service is for light use and retains request throttling. Fresh sources and map tiles need Internet access.

## Updates and troubleshooting

Download a complete backup, stop the app, update dependencies/source, then restart. Migrations apply automatically; verify locations, evidence and reports afterwards. A revision conflict means another tab saved/restored newer data: export on-screen edits before reloading.

Run `pnpm build` then `pnpm start` for production mode. Rebuilding does not erase `.data`.

- Node version errors: use Node 24+. Some releases print an experimental SQLite notice.
- Port busy: stop the other process or choose another port.
- Migration hash changed: restore that SQL file; do not delete the user's database to silence the error.
- Database busy: stop duplicate instances and retry. Failed transactions roll back.
- Missing regional civic/parcels data: add an integration using AGENTS.md; this is not a storage error.
- Failed/stale feeds: retain dates, check the official publisher and retry. Empty data is not an all-clear.

## Sharing source

Keep local databases, backups, credentials and private location details out of Git. Inspect staged files before pushing. Third-party/data licenses and attribution remain separate from technical access.

## Shared studies

Open **Sources & reports → Shared studies**. Set your contributor name, choose the active location, and create a group. Select local observations, routes, or boundaries, inspect them, and **Stage selected contributions**. Then check only the staged contributions to send and download a shared package. Save your study so future exchanges reuse the same record IDs.

Send the JSON file through your chosen private channel. The recipient previews it, chooses a local location to attach the group to, selects contributions, and merges. To return their contributions with your reviews, enter their contributor UUID in the export recipient field; leaving it blank exports only your locally originated contributions. Merge changes remain on screen until **Save study**. Subsequent packages from the same group merge into that group; repeated imports add no duplicates. Conflicting immutable IDs reject the whole import. Personal notes and boundaries remain intact.

Select a contribution revision and add a dated **Confirmed**, **Disputed**, or **Outdated** review, describing what you checked and an optional review deadline. Export the contribution to send your review back. Confirmations apply only to that revision; a new revision starts without those confirmations. Summaries count each contributor's latest assessment of the revision, excluding expired assessments and origin self-confirmations. All review events remain available. Imported revisions retain your displayed selection; select a new revision deliberately.

Packages contain only eligible revisions and reviews of selected records. Your locally created events can be sent; received contributions return only to their original contributor. Third-party reviews and events with unknown provenance are excluded. Included history can still contain private descriptions and coordinates. Routes include complete geometry. Inspect exact JSON before exporting. Address fields, private narratives, other locations, plans and public-data caches are excluded, but selected content can still contain private details and route endpoints. Unchecking does not retract a shared copy. Selecting a third-party record does not override connection boundaries.

Names remain user-chosen; unsigned IDs are self-reported. Unsigned file packages do not authenticate contributors. Signed packages verify individual event signatures and show the publisher fingerprint; compare it independently before trusting a claimed name. The optional companion below can exchange packages with trusted peers. Use trusted channels and verify claims. Keep the server on loopback. Use selective packages to collaborate rather than exchanging databases. Complete backups include your identity, groups, mappings and reviews; keep them private. The separate shared map layer is not yet included in briefings or ATAK exports.

Limits: 25 groups per portfolio, 500 contributions per group, 100 revisions and 500 reviews per contribution. Shared packages are limited to 8 MB; saved studies to 16 MB. Protected identity migration and recovery are described below. Editing others' contributions is not supported. Author corrections and withdrawals are described below.

## Trusted instance sync

The normal app stays on localhost. Start the optional companion from the **same checkout and data directory** in a second terminal:

```sh
pnpm sync
```

This listens on loopback peer port **5186** and a separate localhost-only control port **5185**. Use **Sources & reports → Shared studies → Trusted instance sync**. It works only in the local app, not the hosted site. Custom ports: `pnpm sync --port 5196 --control-port 5195`; set the control port in the panel too.

For a coworker or neighbor on the same LAN, explicitly bind only the companion's peer listener to your computer's private IPv4 address:

```sh
pnpm sync --host YOUR_PRIVATE_LAN_IP
```

Replace the placeholder with your actual private IPv4 address. In this local/LAN mode, only loopback and RFC1918 listener addresses are supported; `0.0.0.0`, public IPs, hostnames and link-local addresses are rejected. The other computer must be able to reach the selected peer port. For remote coworkers use the Tailscale mode described below. Follow your organization's network policy; this app does not configure firewalls, router forwarding or Internet relays. Do not expose the main app or control port. Stop the companion with Ctrl+C. The normal app remains usable without it.

1. Create or import a shared group, stage contributions, and **Save study**.
2. Select the group's contributions using the export checkboxes. Open **Publish selected contributions to a trusted peer**, enter a recipient label, and create an invitation. The allowlist is fixed to these records; their future eligible **saved** revisions/reviews will be available. Paste their signed public identity card, compare the displayed fingerprint through a separate trusted channel, and inspect **Preview outgoing package** before creating an invitation. Extra private notes, new unselected records and unsaved edits are excluded.
3. Send the invitation JSON privately. It includes a random secret that grants read access. The recipient opens **Connect to a coworker or neighbor**, pastes it, and uses **Sync now**.
4. **Review received package** opens the existing selective import preview. Merge and **Save study** when ready. Receiving data never edits or saves the study automatically. Existing displayed revisions remain selected.
5. Exchange an invitation in the reverse direction so you can receive your coworker's contributions and reviews. Each invitation is a separate read permission; a connection never grants access back automatically.
6. Optionally enable **Check automatically every minute** per peer. The companion polls while running, even if the app tab is closed. Signed packages and their review states are retained on disk across restarts. Identical content keeps its decision; new content creates a separate pending entry. Last-check/received dates and refresh failures are visible. A failed refresh retains older received data with a stale label.
7. **Revoke invitation** stops future reads immediately. Copies already received cannot be recalled. **Disconnect peer** stops local pulls and clears its inbox; already merged study information remains. Use **Sharing permissions** to preview and replace an outgoing scope, then send its new invitation. The old invitation is revoked. You can also revoke and create an invitation manually.

Credentials and connection settings are in `peer-sync.json` inside the data directory, separately from the study. They are omitted from normal study backups and Git. Use the encrypted `pnpm identity` recovery kit to migrate the signing key and connection settings together; copying only this file does not preserve a complete federation identity. Restoring someone else's study backup does not grant transport access. Never post an invitation or this file in Git/issues/screenshots. Unix files use owner-only permissions; Windows protection follows the data directory's ACL.

Transport uses Node's [authenticated AES-GCM API](https://nodejs.org/download/release/latest-v24.x/docs/api/crypto.html): 32-byte random invitation secrets, HKDF-separated request/response keys, random 12-byte nonces, 16-byte tags and bound group/request IDs. Requests expire after two minutes and duplicate IDs are rejected; both computers need reasonably accurate clocks. Bodies are encrypted even though private-LAN endpoints use HTTP. Network addresses, timing and approximate message sizes are still observable. The invitation secret encrypts transport; requests also require the recipient private-key signature. Package/event signatures are checked against the direct peers’ pinned keys; there is no forward secrecy or independent security audit. Keep this opt-in protocol on trusted private networks. Fingerprints require independent comparison to identify the person controlling a key. Signatures do not verify the underlying observation.

Service limits: 32 outgoing invitations, 16 connected peers, 8 MB shared packages, bounded request/response sizes, redirects disabled, 15-second peer timeouts and per-address rate limits. An unavailable/deleted saved group or selected record stops publication with a visible failure rather than silently widening the scope. If a service crashed, verify it has stopped before removing only `peer-sync.lock` from its data directory; credentials remain intact.

### Connection boundaries and upgrades

John’s connections to Sam and Tim are separate. John can share his own observations with either person, return Sam’s observations with John’s reviews to Sam, and return Tim’s observations with John’s reviews to Tim. Sam’s observations and reviews do not enter Tim’s feed, or vice versa. This filtering runs for every pull, including new reviews received after an invitation was created. Confirmation counts on the receiving side use only the delivered reviews. Shared group IDs are merge identifiers, not permission to share everything with all connections.

Each revision and review has local provenance: created on this instance, or received from a named sender, with receipt time and peer connection ID when applicable. Provenance is retained in private backups and never exported in shared packages. Imported claims do not become locally authored events merely because their claimed author ID matches yours. Unsigned sender IDs remain self-reported. Signed live connections pin the public key bound to the contributor UUID.

Version 14 keeps older contributions visible but excludes events that lack provenance from outgoing packages. Importing the same old history again does not change that exclusion. To share your own older local observation, stage it in a new group deliberately; obtain new contributions directly from their origin for future exchange. Existing legacy invitations are disabled: revoke them and create version-3 signed invitations for specific recipient contributor IDs after saving the upgraded study. Older clients cannot overwrite the current saved version-18 study. Legacy incoming connections must be disconnected and replaced with new invitations.

Manual files obey the same filtering. The recipient UUID field enables returning that recipient’s contributions with your reviews; it does not enable forwarding somebody else’s contribution. Inspect the exact export JSON. Human copying, restaging received content as a new observation, modified clients and deliberate disclosure are outside this accidental-forwarding safeguard. Previously received copies cannot be recalled.

### Signed identities

After setting your contributor name and saving, start `pnpm sync`. Open **Trusted instance sync → Your signed identity → Load saved signing identity**. The public identity card contains your contributor UUID, display name, Ed25519 public key and a self-signature. Share the card with the other person and compare the complete SHA-256 fingerprint in person or through another trusted channel. A self-signature alone does not identify a human.

When publishing, paste the recipient’s public card, compare its fingerprint and check the comparison box. Preview the outgoing signed package, then create an invitation. When connecting, paste the invitation, compare its publisher fingerprint independently and check that comparison box. Pins are saved locally; a changed key for an existing contributor UUID is rejected, including after disconnect/revocation. Do not bypass a key-change error by deleting settings. There is no automatic key rotation or pin reset. Use the deliberate identity recovery workflow below for lost or compromised keys.

Signed invitations require both the invitation secret and possession of the intended recipient’s private key. The companion signs local revisions and reviews, retains original signatures when returning another person’s contribution, and checks direct author keys against the two pinned identities. Signatures bind group/record IDs, author, event content, dates and review target content. Signed package envelopes cover the transmitted metadata and complete selected event set. Missing/invalid signatures, changed keys and altered content reject the entire signed import or pull. A signature cannot establish truth, freshness, road passability or independent field corroboration.

**Download signed package** in the outgoing preview creates a portable signed file. Import verifies it in the browser before preview/merge and reports the publisher fingerprint. Independently compare that fingerprint: manual file verification checks the same local contact-pin registry as live sync before merge, and checks it again at the moment of merging. The ordinary export remains an unsigned legacy format, clearly labelled at import. Files claiming a known identity must be signed; unknown legacy identities require an explicit unverified-import choice after the companion’s contact checks. All exports retain connection-bound filtering. Incoming files cannot supply local provenance. Receipt histories and public signature proofs are included in private study backups; private signing keys are never included.

The companion stores `field-desk-identity.json` beside `peer-sync.json`, outside study backups and Git. It binds its persistent key to your saved contributor UUID. Privately back up both files with your study if you need to move the same identity to a new machine; protect them as credentials. Losing the key requires deliberate identity recovery, not just restoring a study backup. A missing key with existing signed connections/pins, invalid key file or mismatched contributor UUID stops sync without replacing the key. Unix files use owner-only permissions; Windows inherits the data directory ACL. This stage does not supply encrypted key storage, forward secrecy, automatic rotation or an independently audited transport protocol.

Version 15 saves public proof history and protects it against older study writers. Renew all earlier invitations, including version 2: they lack signed-recipient authentication. Unsigned received history remains available locally but cannot be promoted to signed author history by John; obtain a signed package directly from its origin. Locally originated unsigned events with recorded local provenance are signed as current attestations at export; signed-at time is separate from the recorded event/observation time. Older unknown-provenance events stay excluded. Modern browsers need Web Crypto Ed25519 support; unsupported verification fails closed. Up to 64 public key pins persist independently of the 32 outgoing invitation and 16 active peer limits.

### Contacts and file-import checks

Open **Trusted instance sync → Contacts**. Add a contact’s signed public identity card and a local label. This starts **Pending** and grants no access. Compare the entire fingerprint independently, check the comparison box, then **Verify contact**. Verified contacts with identity cards appear in the outgoing recipient selector. Existing explicitly verified pins migrate as verified contacts without inventing a verification date; add the public card to give them a friendly label and enable the selector.

A contact is separate from a connection or invitation. **Disconnect all connections** stops all incoming connections from that identity, clears their received inboxes and revokes all of your outgoing invitations to them. The contact and its key remain verified; already merged study information remains. A single **Disconnect peer** still removes only that one incoming connection. **Block contact** additionally prevents future connections, outgoing publication and imports involving that identity. **Unblock for verification** returns it to Pending; compare its fingerprint again before verifying. Neither action restores old connections or invitations. Contacts and pins remain in private peer-sync.json, outside study backups and shared packages; there is no delete-pin shortcut or silent key replacement. The combined registry limit remains 64 identities.

Both signed file imports and live sync check saved contact keys. A valid signature from an unknown or pending publisher can be inspected but cannot merge until the contact is verified. Changed keys, blocked authors and third-party histories from a pairwise publisher cannot merge. Signed self-imports check this instance’s key and any other included authors against verified contacts. **Check contacts before import** reevaluates a preview after contact changes. The app checks permissions again at merge time, invalidates previews after its own contact actions, and rejects results if the study/control port changed during the check.

Start the companion for contact-controlled imports and use the same control port shown in the panel. There is no automatic offline or hosted-site bypass: signed files remain inspectable, but unavailable contact verification prevents merging. Unsigned files claiming a known local/contact identity are rejected as downgrades. An unknown unsigned legacy file can be imported only as explicitly unverified claims after the companion checks that it does not involve blocked/known identities. Use signed packages for verified peers. Blocking cannot retract previously received copies or erase already merged history.

A blocked public key stays blocked if it claims a new contributor UUID; adding the same key under another contact ID is rejected.


### Review shared changes

Shared-study imports classify each contribution as New, Updated, Unchanged or Conflict. Only new/updated records start selected; Select changes and Deselect all operate on the whole package even when a filter hides records. Unchanged records can be selected explicitly. New signature proofs count as an update without implying new observations. Conflicting immutable IDs or signing keys cannot be selected; inspect the discrepancy with the sender. Omitted records do not retract earlier copies. Contact verification still gates imports and runs again at merge.

Expand a contribution and use Compare with your displayed revision to see changed names, descriptions, source/date/confidence fields and complete coordinates. Comparison selection does not change the map. After merging, select a displayed revision explicitly if appropriate, then Save study. Your earlier displayed revision remains selected by default.

Contributions & reviews offers All, Needs attention and Multiple revisions filters. Needs attention includes revisions with later claimed creation instants, disputes/outdated reviews of the displayed revision, and reviews past their review-by date. Reviews of other revisions never confirm or dispute the displayed one. These are local review prompts; they do not certify truth, resolve disagreements or automatically adopt a peer's version.


### Persistent federation inbox

Open **Sources & reports → Shared studies → Trusted instance sync → Federation inbox**. Filter Pending, Deferred, Dismissed, Merged or All; expand an update to preview its exact package, record a reason, defer, dismiss or return it to pending. Nothing changes your study until explicit merge and Save study. **Mark merged after saving** checks that all package contributions, revisions, reviews and signature proofs exist in the saved study. A partial merge can be deferred until the remaining contributions are handled. Dismiss/defer requires a reason. Conflicting decisions from an older tab are rejected.

A header Inbox button follows you across application tabs, showing pending count and any peer errors; its tooltip includes deferred count and last successful sync. Click it to open Shared studies. The control port is remembered in this browser and shared across its tabs. Counts refresh every ten seconds while the page is open. Companion collection is still opt-in per peer. When the service becomes unavailable, the last visible counts are labeled offline rather than cleared or reported as current.

The private `peer-inbox.sqlite` database (plus SQLite WAL/SHM sidecars) lives alongside the companion config and private signing key in your data directory. It contains received study information, review reasons, content receipts and last-check/last-success dates. It is omitted from Git, normal study backups, outgoing packages and public release source. It uses the same OS/data-directory access protection as your local study; it is not encrypted at rest by this feature. To preserve it during a machine move, stop the companion before copying its private directory.

Identical immutable contribution content is deduplicated per connection even when envelope/signing timestamps or record ordering change. Original packages/signatures remain intact. Up to 128 package copies / 64 MB are kept; collection failures or capacity limits retain existing pending updates. **Clear merged and dismissed package copies** frees only handled copies; pending/deferred updates remain. Up to 2,048 compact receipts suppress cleared content on later pulls; content older than this bounded receipt history can appear again. Decisions are local bookkeeping and are not sent to peers.

Startup revalidates stored packages and signatures; invalid data stops the service with the original database retained for recovery. Preview and decisions recheck current contact and connection permissions. Blocking/disconnecting clears that connection's private inbox/checks/receipts and prevents in-flight pulls from recreating them; saved study history stays intact. Restoring a study backup neither restores this inbox nor grants peer access. No portfolio version or main-study SQL migration is needed.


### Remote coworkers with Tailscale

Use **Sources & reports → Shared studies → Trusted instance sync → Remote setup & connectivity**. Install the official [Tailscale client](https://tailscale.com/download) on both computers and sign in. In separate tailnets, share the publisher computer with the recipient and have them accept the device share; for two-way connections share each computer with the other person. In a managed organization, follow its device approvals and access policy. Limit access to the companion TCP peer port (default 5186) rather than exposing the app or control port. See [device sharing](https://tailscale.com/docs/features/sharing) and [sharing versus inviting/access policies](https://tailscale.com/docs/reference/inviting-vs-sharing).

Start the optional companion on each computer:

```sh
pnpm sync --tailscale
```

It reads `tailscale status --json` from the installed client and selects an owned Tailscale IPv4 address. An explicit owned address is supported with `--tailscale --host YOUR_TAILSCALE_IPV4`; custom peer/control ports still work. Default `pnpm sync` keeps loopback behavior and has no Tailscale dependency. The normal app and control listener remain localhost-only. No account login, network-policy edit, device share, router port forwarding, public website, Serve/Funnel or relay hosting is performed by Field Desk. Tailscale handles its own network connectivity.

Exchange public Field Desk identity cards and compare fingerprints independently, select saved group contributions and create recipient-bound invitations as before. Each direction has its own device access and Field Desk invitation. Tailscale reachability never grants study permission, and John still cannot forward Sam's received contributions/reviews to Tim. Remote invitations embed the companion's numeric Tailscale IPv4 endpoint; do not replace an address by editing signed JSON. If the bound address changes, stop/restart the companion, revoke old outgoing invitations and issue new ones.

**Check Tailscale status** reports client/login/approval/disconnection problems, owned IPv4 addresses and online/visible state only for configured peers. It strips account details, hostnames, auth URLs and unrelated peer addresses from UI responses. **Test signed connection** performs a real signed, encrypted read and verifies the expected sender/group/authors and contact permissions. It neither queues the package nor changes the study. Tailscale-reported Online only means control-plane presence; the application test checks actual port access and signed protocol.

A remote pull requires explicit Tailscale mode, a running/connected local client, continued ownership of the listener IP, and a visible online peer in `100.64.0.0/10`. The range alone is not trusted because it is also used by other CGNAT networks. Missing/offline peers fail before a fetch; retained inbox data stays dated. Automatic retries continue at the existing opt-in one-minute interval; manual retry is Sync now. If an online peer fails the signed test, check its companion, both device shares, Tailscale access policy, OS firewall access to the peer port, invitation revocation and clocks. No firewall rules are changed automatically.

Both Tailscale clients and sync companions need to run simultaneously for a transfer. Already received updates remain in the persistent local inbox. Delivery from a stopped sender is not implemented. This stage supports numeric IPv4, not MagicDNS, public DNS, public IPs or IPv6. Remote validation uses the CLI documented in [Tailscale's reference](https://tailscale.com/docs/reference/tailscale-cli); commands are read-only, bounded and shell-free. Two-household live validation still requires real enrolled/shared devices.


### Share findings and plans

In Shared studies, use **Show local content** to filter observations, boundaries, routes, findings, evidence, questions, service plans or scenarios. Only records from the active location are offered (routes retain their existing endpoint scope). Nothing is selected automatically; hidden checked items remain selected when filtering. Stage selected items to create immutable contribution revisions, inspect the staged versions, then explicitly choose outgoing records. Recipients need an updated Field Desk version to read expanded payloads. Older peers reject unsupported records; their version does not silently discard them.

Findings share the selected section narrative. Evidence shares its dated captured snapshot, source URL, stance and provenance label, without its private local record ID. Questions include assessment, assumptions, confidence, deadlines and requirement text; supporting evidence is a separate selection. Service plans include dependencies, alternatives and embedded resource snapshots, including their coordinates and dates. Scenarios include the current assessment, indicators, actions and exercise results; private archived scenario versions are omitted and their count is shown. Review all wording, URLs, responsibility fields and resource coordinates for private details before staging.

Related items link through shared contribution UUIDs only when explicitly co-selected at staging. Omitted links remain counted; no linked evidence or plan is automatically pulled into the selection. Local named-area links and task/indicator evidence-link IDs are removed; current document-level shared references provide context, not a replacement for those private local relationships. Scenario archive labels and local parent/source IDs stay private. If a later export/import omits a referenced contribution, the view says related content is not included; sharing a reference does not share that record. Stage related items together to update their portable references.

Imports preserve documents as shared contributions: they do not overwrite personal collection questions, service plans, scenarios or narratives. Use dated revision-specific reviews and comparisons as with observations. Text documents have no invented map position; inspect them in Shared studies. Only observation/route/boundary contributions create map overlays. Shared documents remain excluded from briefings/ATAK in this stage.

Portfolio v16 migrates earlier supported studies and backups, preserves existing shared history, and rejects v15/older saves once a v16 study is saved. Download a backup before updating. The signed package envelope remains v2; document content and shared references are included in its immutable event signatures. Pairwise provenance, contact checks, saved-only grants and inbox merge acknowledgment apply to every new kind. No main-study SQL migration is needed.


### Author corrections and withdrawals

Updating an existing locally staged contribution creates a **Corrected** revision with a reason and date. Supply a correction reason when staging; the default asks recipients to compare the complete revised snapshot. Original versions and revision-specific reviews remain available. A correction is not automatically selected by recipients.

Open your own contribution's **Withdraw this contribution** panel, enter a reason, and **Stage withdrawal notice**. Save the study and exchange updates so peers can receive it. The notice preserves the content and history, hides the contribution from shared map pins even when an older revision remains selected, and flags shared references to it. Receiving or merging a notice does not erase previously received copies. Revoking an invitation and withdrawing information are separate actions.

Only the origin contributor with recorded local provenance can issue a withdrawal here. Stage corrected local content again to create a new revision after a withdrawal; the withdrawal itself stays in the history. Notices are signed as author revisions with the existing pairwise boundaries. Unknown-provenance and third-party histories cannot acquire local author status. Notices are dated contributor claims, not proof of inspection.

Portfolio version 17 preserves notices and rejects older writes after a save. Older clients reject packages containing notices; update both peers before exchanging them. Live invitations advertise capabilities and pull requests sign recipient capabilities. Incompatible documents or notices are rejected before sending the package, with an update/renew-invitation message. Old invitations without capabilities must be renewed.


### Inspect and replace sharing permissions

Open **Trusted instance sync → Sharing permissions · who receives what** and refresh. Each contact shows outgoing saved-record allowlists, incoming connections and whether a reverse connection is configured for the same group. Incoming records describe only the latest retained, verified package; the publisher's full current grant scope is not known. A configured reverse connection does not prove current connectivity.

**Change selected scope** starts from the existing allowlist. New records stay unchecked. Select only eligible contributions, then **Preview replacement scope** to inspect the complete signed package and additions/removals. **Replace invitation with this scope** atomically revokes the old invitation and creates a new recipient-bound invitation with a fresh secret. Send the replacement privately; the recipient must disconnect the old connection and connect the new invitation. Removing permission stops future reads but cannot erase received copies. Previously saved grants remain intact if validation/storage fails. A changed saved study, grant or contact invalidates the preview.

### Guided setup and compatibility

**Set up sharing with a coworker or neighbor** walks through local startup, public identity exchange, fingerprint verification, outgoing selection, the reverse invitation, and signed connection testing/review. Choose the intended contact; local setup indicators refer to that contact. They do not certify remote reachability or a successful household test.

New signed invitations advertise supported document kinds and author notices. Recipient capabilities are part of the signed encrypted request. The publisher rejects unsupported selected content rather than dropping fields or delivering an incomplete substitute. Old invitations need renewed invitations after updating both instances. Portable files cannot negotiate with the sender, so unsupported files fail closed and require an app update; imports still check contacts and signatures before merge.


### Encrypted identity recovery kit

Normal app backups intentionally omit keys and invitation credentials. Use **Trusted instance sync → Back up, move or recover your federation identity** for the command reference. These operations run offline in an interactive local terminal. Stop both the app and companion before using `--servers-stopped`; operations also acquire the companion lock. No keys or passphrases enter browser controls. The default source is `.data`; `--data-dir PATH` overrides it, as does `AREA_STUDY_DATA_DIR`.

```sh
pnpm identity backup --file private.field-desk-recovery --servers-stopped
pnpm identity preview --file private.field-desk-recovery
pnpm identity restore --file private.field-desk-recovery --destination .data-restored --servers-stopped
```

Backup asks for a passphrase twice, with input hidden. Use at least 12 characters, preferably a long unique phrase, and keep it separate from the kit. The kit uses scrypt (N=32768, r=8, p=1), a random salt and AES-256-GCM with an authenticated format header. It contains the saved complete study/briefings, Ed25519 private identity, verified/blocked contacts, pins, exact incoming invitations and outgoing scopes/secrets. Public-data caches and pending inbox copies are excluded. Passwords cannot be passed in command arguments or environment variables. Existing kit files are never overwritten. Kits are ignored by Git under the `.field-desk-recovery` extension; keep them private anyway.

Restore decrypts and validates identity/key bindings, signed invitations, pins and study limits before writing. Type the preview contributor UUID and full fingerprint to confirm. The destination must not exist; restoration stages into a sibling directory. Existing study directories cannot be overwritten. Set `AREA_STUDY_DATA_DIR` to the restored directory before starting **both** the app and companion. In PowerShell, for example: `$env:AREA_STUDY_DATA_DIR = '.data-restored'`. Stop using the original installation after migration: independently editing two copies of one signing identity can create conflicting histories. Automatic peer polling is paused after restore; review connections before enabling it. Pending copies reload via sync; renew invitations if your peer address changed. Contact trust is restored deliberately with the encrypted kit; there is no silent key replacement or pin reset.

### Lost or compromised signing key

If the original key is gone or compromised, preserve the old data directory and run:

```sh
pnpm identity recover --destination .data-recovered --reason "Lost signing key" --servers-stopped
```

Type the old contributor UUID to confirm the recovery. This creates a new UUID/key and saves the study/briefings into a separate directory. Old groups, authorship, proofs and provenance remain historical; they cannot be signed as the new author. Incoming connections and outgoing invitations start empty. Existing other-contact pins and block states remain. The old directory receives a retirement marker and cannot start sync. Point both local processes at the new directory, create a new local group and deliberately stage your own current information there.

Tell every peer that the old identity is retired. They must **Block contact** on your old UUID/key, add your new public identity card, independently compare the full fingerprint, verify it, and exchange new invitations. Field Desk never overwrites the old trusted key. A compromised key on another machine and previously received copies cannot be revoked remotely by this recovery command. Retired-directory kits are not created; do not remove the retirement marker or run an old installation to bypass retirement.

Live private keys remain local disk files; a recovery kit does not add encrypted live-key storage or protect an already compromised running computer. Unix files use owner-only permissions; Windows uses the data directory ACL. Kits are bounded to 100 MB of decrypted content, with bounded encoded input. Wrong passwords or modified files leave existing data intact.

A persistent public `field-desk-identity-binding.json` also remembers the original key/UUID. Missing or changed keys fail closed even without active connections. Kits regenerate this binding from the explicitly restored key. Preserve it with the data directory; do not delete it to bypass recovery.


### Search, bulk reviews and capacity

Shared studies supports search across contributed names/content, authors, source fields and review explanations. Filter by author/type, attention, multiple versions or withdrawal. Lists show 25 items per page; local candidate and incoming lists are paginated too. Collapsed snapshots/review histories render when opened. Search indexes and large previews are reused between keystrokes. Export/staging selections persist across filters/pages, and the exact preview covers all checked items. Removing a filter never automatically selects content.

**Review several displayed revisions** lets you select up to 100 targets, enter a common assessment, checked date, explanation and optional review deadline, and preview every target UUID/revision. Confirm that the explanation applies to each before applying on screen. A changed study invalidates the preview. The action is atomic: an invalid/missing target or capacity failure leaves the original study untouched. Existing histories and displayed selections stay intact. Save and exchange reviews deliberately; a bulk assessment is not independent corroboration.

**Storage & sharing capacity** shows current on-screen study bytes, group counts, per-record history limits and export size. Inbox controls show count/byte capacity separately. Portfolio v18 protects the expanded limits from older tab writers. The saved-study cap is 16 MB; portable packages 8 MB, complete backup imports 96 MB, inbox copies 128 / 64 MiB. Records/history are never silently trimmed to fit. The existing briefing limits remain 30 reports / 2 MB per report. Protected recovery kits now allow 100 MB decrypted content to accommodate the expanded study and complete archives.

### Incremental record exchange

Updated peers advertise incremental batches, expanded history and larger packages in signed invitations. Renew invitations after updating to advertise these capabilities. Each pull signs its bounded per-connection record-hash inventory. Inventories are populated only from signed, trusted packages received on that connection, kept in the private companion SQLite inbox, and never shared with another contact. They are collection acknowledgments, not confirmation of the underlying claims or proof that the user merged them.

The publisher applies the existing pairwise author/provenance filter first, then sends only changed records, up to 100 per batch and 8 MB including signatures. Each changed record retains its **complete eligible revision/review history**; this is record-level incremental exchange. Package batch metadata is signed. The companion stores each batch before acknowledging it and continues until caught up. An interruption retains partial batches and resumes using the durable inventory. Unchanged pulls do not create empty inbox entries. Review/merge/save remains explicit, and related documents may arrive in another batch; missing references never cause automatic inclusion.

Initial publication and scope replacement preview every signed package batch needed to cover the full eligible selection. Portable signed downloads are separate valid package files, one per batch. No aggregate array is a shared-package file. Grant allowlists still require explicit selection and cannot grow through polling. Individual records whose full signed history exceeds 8 MB fail visibly; create a smaller new contribution deliberately rather than deleting history to silence the limit.

**Recheck full selected scope** bypasses the saved inventory for that run. Existing inbox decisions are retained; overlapping package batches can be inspected idempotently. Disconnect/block clears that connection's inventory along with its inbox. Recovery kits omit both; restored instances pull fresh snapshots. Pulls are bounded to 50 batches / roughly 90 seconds per operation, with existing per-request/network/rate limits; partial data stays available if a bound is reached. No automatic eviction of pending/deferred updates. This does not supply offline delivery while the publisher is stopped, or atomic consistency across multiple publisher snapshots.
