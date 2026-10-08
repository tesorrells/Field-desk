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
