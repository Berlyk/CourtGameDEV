# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + Socket.IO
- **Database**: None (rooms stored in memory)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server + Socket.IO
│   └── court-game/         # React + Vite frontend (court game)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Court Game Application

### Architecture

The court game is a multiplayer board game assistant where:
- Players join rooms via a 5-character code
- The host starts the game and controls stage progression
- Each player receives a unique role, private facts, and mechanic cards
- All actions (reveal fact, use card, change stage, verdict) are broadcast in real-time via Socket.IO

### Socket.IO Events

**Client → Server:**
- `create_room` — create a new room
- `join_room` — join existing room by code
- `start_game` — host starts the game (assigns roles, facts, cards)
- `reveal_fact` — player reveals one of their facts to all
- `use_card` — player uses one of their mechanic cards
- `next_stage` — host advances the trial stage
- `set_verdict` — judge submits the final verdict

**Server → Client:**
- `room_joined` — confirmation with full state
- `room_updated` — players list changed
- `game_started` — game began, each player gets personalized state
- `facts_updated` — a fact was revealed (broadcast to all)
- `my_facts_updated` — player's own fact status changed
- `cards_updated` — a card was used (broadcast to all)
- `my_cards_updated` — player's own card status changed
- `stage_updated` — judge moved to next stage
- `verdict_set` — judge submitted verdict (broadcast to all)
- `error` — error message for the client

### Room Storage

Rooms are stored in memory in `artifacts/api-server/src/socket/roomManager.ts`. No database required.

### Game Cases

Cases are defined in `artifacts/api-server/src/socket/gameData.ts`:
- 3 players: Civil dispute, Labor dispute
- 4 players: Criminal case (phone theft)
- 5 players: Criminal case (night club assault)
- 6 players: Corporate lawsuit

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
