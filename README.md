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
