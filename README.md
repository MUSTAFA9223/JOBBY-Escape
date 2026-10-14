# JOBBY Escape

An independent 2D multiplayer browser game for the JOBBY community. This repository is separate from the production JOBBY website and Telegram bot.

## Current foundation

- Browser arena with keyboard and touch movement
- Socket.IO rooms with 5-character invite codes
- Quick-match room queue
- Up to 8 players in a room
- Shared player movement and live score updates
- Gold shard collection, player list, and health endpoint at `/health`

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000 in two browser tabs to test room creation and joining.

## Deploy the multiplayer server

The game needs a Node.js host that supports long-lived WebSocket connections. It cannot be made fully multiplayer by hosting only static files on a static-pages service.

A simple option is a **separate Railway service** connected to this repository:
1. Create a new Railway project/service for JOBBY Escape only.
2. Connect this repository.
3. Set the start command to `npm start` (normally detected automatically).
4. Deploy and test the generated public URL and `/health` endpoint.

Do not connect this repository to the production JOBBY website or bot service. Do not add production secrets to this game unless a later feature genuinely requires them.

## Current limitations

This is the initial multiplayer foundation, not a finished release. The current player drawing is temporary placeholder art, not the official JOBBY character. Persistent accounts, secure authoritative game simulation, proper round/obstacle mechanics, durable leaderboards, anti-cheat protections, and deployment verification still need work. Do not treat the current score as a reward or token balance.

## Planned milestones

1. Complete the core escape round and spectator/result screens.
2. Replace placeholder art with the approved current JOBBY character assets.
3. Add room host controls, match lifecycle, rematch, and reconnection handling.
4. Add persistent player profiles and leaderboard with appropriate abuse controls.
5. Deploy independently and verify multi-browser/multi-device play.
6. Adapt the web game for Telegram Mini App after the web release is stable.
