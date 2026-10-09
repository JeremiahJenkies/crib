# CRIB Ranked Hub

CRIB is a server-backed Roblox BedWars scrim, ranked and late-game tracker.

## Architecture

Browser -> Node HTTP API -> data.json

The browser never calculates authoritative RP. The server handles player creation, match recording, RP changes and persistent data.

## Run locally

1. Install Node.js 20+.
2. In this folder run:
   `npm install`
3. Start CRIB:
   `npm start`
4. Open:
   `http://localhost:3000`

Do not open index.html directly with file:// because the API is served by the Node server.

## Admin

Set the environment variable `CRIB_ADMIN_TOKEN` before starting the server. Never commit a real admin token to GitHub.

## Current server features

- Multiple independent player profiles
- Persistent player and match storage
- Standard Scrims
- No-Bed Scrims
- Winstreak 1v1 validation
- Reservoir Custom Match Late Games
- Score-only LG rating
- Server-side RP calculation
- Kit-specific Scrim RP modifiers
- No Kit highest modifier
- Admin configuration endpoints

## Data persistence across updates and deployments

CRIB writes its state atomically to a JSON file and keeps a last-good `data.json.bak` recovery copy. The data file location can be configured:

- `CRIB_DATA_FILE=/absolute/path/to/data.json` selects the exact file path.
- Alternatively, `CRIB_DATA_DIR=/absolute/path/to/persistent-folder` stores `data.json` in that folder.
- If neither is set, local development uses `data.json` in the project folder.

**For hosted deployments:** attach a persistent disk/volume to the service and set `CRIB_DATA_FILE` to a path inside that mounted volume (for example `/var/data/data.json`). A backup on an ephemeral filesystem cannot survive a host replacement, so a persistent volume is required for reliable survival across redeploys. Do not use a repository checkout as a live database.

## Update Tree

The Update Tree page lists dated repository changes by feature area. GitHub Actions regenerates `updates.json` from Git commit history when code is pushed to `main`. Dates are stored as ISO timestamps and displayed in the viewer's local timezone.
