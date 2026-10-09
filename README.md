# Field Desk

A local intelligence workspace for understanding the places around home, work and other locations. Define an Area of Responsibility (AOR) and Area of Interest (AOI), collect public information, record evidence and gaps, compare routes, plan contingencies and produce dated briefings.

**Runs on your computer. No hosting account or login is needed.** Data is stored in a local SQLite file. One installation contains one study portfolio with multiple locations.

## Start

Install **Node.js 24+** and **pnpm 11** (`npm install -g pnpm@11.25.0`), then:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. Storage and migrations are created automatically. Stop with Ctrl+C; `pnpm dev 5174` selects another port.

1. Set an address or map pin and draw its AOR/AOI.
2. Review map layers and their sources, dates and coverage limits.
3. Capture evidence, write findings and track unresolved questions.
4. Add service alternatives, scenarios and routes between locations. Services & infra also includes nearby repeaters and saved local radio frequencies.
5. **Save study** to retain edits. **Sources & reports → Export to ATAK** downloads a previewed KML/KMZ map overlay. **Sources & reports** contains review reminders, printable briefings and **Backup & restore**.

## Your data

- `.data/area-study.sqlite` stores studies, source caches and archived briefings. `.data/` is ignored by Git.
- Download a complete backup before upgrades or moving computers. It includes the whole portfolio and saved briefings; restore provides a preview and recovery-copy confirmation.
- Unsaved edits remain on screen until saved; backups can include them.
- The server binds to localhost. This is a personal local app, not a multi-user public service.
- Fresh data and map tiles require Internet access. Geocoding/routing providers receive submitted locations; other services receive relevant geographic requests. Credentials and hosting settings are excluded from backups.

## Coverage

Nationwide baseline: Census geography, OpenStreetMap places, FEMA flood/risk data, USGS observations and NIFC fire incidents, subject to each source's limits. Local parcels, civic records, utilities and incident feeds are strongest in Travis/Hays counties and Austin/Manor/Wimberley. Texas layers remain Texas-specific; other towns need additional local integrations.

Missing, stale, partial and failed sources are visible. A mapped hazard is not a current closure; an empty result is not an all-clear. Posts and agency reports require review before becoming findings. X, Facebook and Nextdoor are not automatically collected without supported access.

## Development

`pnpm check` runs offline checks. Use `pnpm typecheck` and `pnpm build` to validate changes; `pnpm start` runs the production build.

Read [AGENTS.md](AGENTS.md) before adding integrations or parsers. Optional settings, upgrades and troubleshooting: [Local setup](docs/LOCAL_SETUP.md).

## License

Project code is MIT licensed; third-party notices stay with their files. Data and upstream services have their own terms/attribution. The Area Intelligence Handbook is a reference, not a bundled asset.

The **ALPR cameras** map layer uses community-reported OpenStreetMap data, the underlying source used by [DeFlock](https://deflock.org/), without an API key. It shares 24-hour area caches and retains source links and edit dates. Reports are incomplete and do not confirm current operation. Data: [© OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright).

**Weather overlays** in the map sidebar provide [RainViewer](https://www.rainviewer.com/api.html) past radar with playback/opacity controls and [NWS](https://www.weather.gov/documentation/services-web-api) alert polygons for the current view. Radar is regional resolution, not a forecast; RainViewer free-use terms apply. Some NWS alerts lack polygons and remain available through point-based Dashboard checks. Live weather is excluded from ATAK exports and briefings.
