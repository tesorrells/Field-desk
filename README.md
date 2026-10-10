# Field Desk

A local intelligence workspace for understanding the places around home, work and other locations. Draw an Area of Responsibility (AOR) and Area of Interest (AOI), collect public information, record evidence and gaps, compare routes, plan contingencies and produce dated briefings.

**Runs on your computer. No hosting account or login is needed.** One installation stores a multi-location study portfolio in local SQLite.

## Start

Install **Node.js 24+** and **pnpm 11** (`npm install -g pnpm@11.25.0`), then:

```sh
git clone https://github.com/tesorrells/Field-desk.git
cd Field-desk
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. Storage and migrations are created automatically. Stop with Ctrl+C; `pnpm dev 5174` selects another port.

1. Set your own address or map pin and draw its AOR/AOI.
2. Review map layers, source dates and coverage limits.
3. Capture evidence, write findings and track unresolved questions.
4. Add service alternatives, radio frequencies, scenarios and routes between locations.
5. **Save study** to retain edits. **Sources & reports** contains dated briefings, previewed ATAK KML/KMZ exports, **Shared studies** and **Backup & restore**.

## Coverage

Nationwide baseline includes Census geography, OpenStreetMap places, FEMA flood/risk data, USGS observations and NIFC fire incidents. Local parcels, civic records, utilities and incident feeds are strongest in Travis/Hays counties and Austin/Manor/Wimberley. Other towns may need new local integrations; Texas feeds remain Texas-specific.

Weather layers include past radar, NWS alerts, NOAA rainfall estimates, airport stations, HeatRisk, satellite smoke, AirNow monitor AQIs and storm/excessive-rainfall outlooks. Sources retain dates and missing/stale/partial flags. Live weather is excluded from briefings and ATAK exports.

ALPR camera reports use OpenStreetMap data, the underlying source used by [DeFlock](https://deflock.org/). They do not confirm current operation. Data: [© OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright). Radar uses [RainViewer](https://www.rainviewer.com/api.html), whose free-use terms apply.

An empty feed is not an all-clear; a hazard polygon does not establish road passability. Agency reports and community posts require review. X, Facebook and Nextdoor are not automatically collected without supported access.

## Share with coworkers or neighbors

**Shared studies** exchanges selected observations, routes, boundaries, findings, evidence, collection questions, service plans and scenarios. Incoming snapshots stay separate from private plans. Preview, merge and save explicitly; receiving an update never automatically replaces your chosen revision.

Run the optional companion in another terminal:

```sh
pnpm sync --tailscale
```

For separate homes, install and configure Tailscale first. Both companions must be online during transfer. Compare full identity fingerprints through a separate trusted channel and exchange recipient-bound invitations in both directions. The local app stays on localhost.

- Each contact gets an explicit scope. John cannot automatically forward Sam's contributions or reviews to Tim.
- Signed corrections, withdrawals and dated reviews preserve history. Signatures establish key authorship, not observation truth.
- Incoming updates persist in a review inbox. Search, filters, pagination, exact-revision bulk review and incremental batches support larger studies.
- Scope replacement/revocation stops future reads; already received copies cannot be recalled. Upgrade both peers and renew older invitations.

[Setup, permissions and recovery](docs/LOCAL_SETUP.md#trusted-instance-sync) · [Federation roadmap](docs/FEDERATION_ROADMAP.md) · [Validation and manual remote checklist](docs/FEDERATION_VALIDATION.md)

The separate-network acceptance test remains pending. There is no offline relay, forward secrecy or independent cryptographic security audit.

## Your data and upgrades

`.data/area-study.sqlite` stores the portfolio, source caches and archived briefings. The companion keeps keys, contacts, invitations and its inbox separately in the same data directory. These files are ignored by Git; keep custom data directories private too.

Download a complete study backup before upgrading. It includes the portfolio and saved briefings, **not** private keys or connection credentials. To move or protect a federation identity, use the separate encrypted `pnpm identity` recovery-kit workflow with both servers stopped; see [identity backup and recovery](docs/LOCAL_SETUP.md#encrypted-identity-recovery-kit). Unsaved edits remain on screen until saved; browser backups may include them.

Fresh feeds and map tiles require Internet access. Geocoding/routing providers receive submitted locations; other services receive relevant geographic requests. This is a personal local app with an optional peer companion.

## Development

```sh
pnpm check
pnpm typecheck
pnpm build
pnpm start
```

`pnpm check` runs offline fixture checks. Read [AGENTS.md](AGENTS.md) before adding sources or parsers; keep dates, attribution, geography, failure semantics and privacy intact. Operating details: [Local setup](docs/LOCAL_SETUP.md).

Code is MIT licensed; third-party notices and upstream data/service terms apply. The Area Intelligence Handbook is a reference and is not bundled. Private studies, addresses, keys, recovery kits and generated output must not be committed.
