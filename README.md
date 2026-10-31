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

## Admin authentication (Discord OAuth2)

CRIB admin access uses Discord OAuth2 identity verification. Only these Discord user IDs are allowed by default:

- `1365035459465580585` — casperspishogue / CRIB username `h3lixsquared`
- `1333892338166005830` — duskydemiseee / CRIB username `tellmeishouldmoveon`

The server checks immutable Discord user IDs returned by Discord's `/users/@me` endpoint; displayed usernames are informational only. Admin sessions are stored server-side and use an HttpOnly, SameSite=Lax cookie with a 12-hour lifetime. The session store is in memory, so users must sign in again after a server restart.

Configure these environment variables on the hosting provider (never commit the client secret):

- `CRIB_DISCORD_CLIENT_ID` — Discord application client ID
- `CRIB_DISCORD_CLIENT_SECRET` — Discord application client secret
- `CRIB_DISCORD_REDIRECT_URI` — exact OAuth2 redirect URL, e.g. `https://YOUR-DOMAIN/api/admin/callback`
- `CRIB_DISCORD_ADMIN_IDS` — optional comma-separated override for the approved Discord IDs

In the Discord Developer Portal, add the exact value of `CRIB_DISCORD_REDIRECT_URI` to the application's OAuth2 Redirects. The OAuth2 scope required is `identify`. After configuring the environment variables, redeploy CRIB. Admin configuration, kit balancing, and match verification are then available only to the approved Discord accounts.

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
