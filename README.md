# JOBBY Escape

JOBBY Escape is an independent browser-based 2D multiplayer escape platformer for the JOBBY community. It is separate from the JOBBY production website and Telegram bot.

## Current game foundation

- Side-scrolling-style 2D obstacle course with platforms, hazards, collectibles and an exit
- Keyboard and on-screen touch controls
- Solo rooms, random matchmaking, and private rooms with five-character invite codes
- Up to 16 players per room; total capacity can grow by adding more rooms and server capacity
- Live player list and round leaderboard
- Room text chat
- Experimental peer-to-peer WebRTC voice chat; microphone permission is required and some networks may require TURN relay configuration
- Health endpoint at `/health`

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. Create a room to play solo, or open another browser/device and join with the invite code to test multiplayer.

## Deployment

The game requires a Node.js host that supports long-lived WebSocket connections. Keep it on a separate service from the JOBBY website and Telegram bot. Do not add production secrets or connect production services to this repository.

## Important limitations

This is a playable prototype, not a finished commercial release. The character artwork is temporary original placeholder art; replace it with the approved current JOBBY character assets when available. The server relays player positions but the physics and collectible scoring are still client-side, so competitive anti-cheat hardening is still required. The WebRTC voice mesh is intended for small rooms and may need a TURN service to work across restrictive networks. Scores are game-only and are not token balances or rewards.

Next milestones: verify deployment and multi-device play; harden authoritative movement/scoring; add persistent accounts and leaderboard; improve art, mobile polish and round lifecycle; then adapt to Telegram Mini App.
