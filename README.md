# Galaxy Game

A 2D top-down space grand strategy game inspired by Stellaris, built with Node.js, TypeScript, and SQLite.

## Features (Planned)

- Procedural galaxy generation with star systems and hyperlanes
- Ship classes: Science, Constructor, Military, Colony
- Economy: Energy Credits, Minerals, Science, Alloys
- Planetary colonization with role-based production
- Technology research tree
- Combat system with shields, armor, and hull
- AI empires with FSM (Explore/Expand/Develop/Attack)
- Fog of War exploration
- Real-time with pause control

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Database:** SQLite (better-sqlite3)
- **Server:** Express
- **Client:** HTML5 Canvas (planned)

## Getting Started

```bash
# Install dependencies
npm install

# Initialize the database
npm run db:init

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

The game server runs at `http://localhost:3000` by default.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Server health check |
| `/api/game/state` | GET | Current game state summary |
| `/api/game/speed` | POST | Set game speed (paused/slow/normal/fast) |
| `/api/game/action` | POST | Perform a game action |

## Project Structure

```
src/
  shared/          # Shared types and config
    types/         # TypeScript type definitions
    config.ts      # Game configuration constants
  server/
    database/      # SQLite connection, schema, init
    engine/        # Game loop and engine
    routes/        # Express API routes
    index.ts       # Server entry point
public/            # Static client files
```

## License

MIT
