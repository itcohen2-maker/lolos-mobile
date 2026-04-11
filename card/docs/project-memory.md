# Salinda — Project Memory

One-stop context doc so you can clone this repo on any machine and get productive fast.
Last updated: 2026-04-11.

## What this project is

**Salinda** — a math card game built with Expo / React Native (client) and a Node + Socket.IO multiplayer server. Supports web, iOS, and Android via Expo. UI is bilingual (Hebrew/English) with RTL defaults. Branding: Salinda logo + Fredoka font.

- Client entry: `index.tsx` (legacy monolith still in use) and `App.tsx`
- Modular screens under `src/screens/` and `src/components/screens/`
- Shared types + i18n under `shared/`
- Multiplayer server under `server/` (TypeScript, compiled to `dist/server/src/index.js`)

## Getting started on a new PC

```bash
# 1. Clone
git clone https://github.com/itcohen2-maker/lolos-mobile.git
cd lolos-mobile/card

# 2. Install root + server deps
npm install
npm install --prefix server

# 3. Copy env
cp .env.example .env
# edit .env as needed (see flags below)

# 4. Run the multiplayer server (separate terminal)
npm run server:dev

# 5. Run the Expo client
npx expo start --clear
# press w for web, or scan QR in Expo Go on your phone (same Wi-Fi)
```

## Environment variables (`.env`)

| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_SERVER_URL` | Remote Socket.IO server URL (prod on Render: `https://lolos-mobile.onrender.com`) |
| `EXPO_PUBLIC_LOCAL_SOCKET_SERVER` | `1` = dev-only flag, forces client to use local LAN server (ignores `EXPO_PUBLIC_SERVER_URL` for online play). `0` = use cloud. |
| `EXPO_PUBLIC_WEB_APP_URL` | Public web build URL (Render: `https://salinda-web.onrender.com`) |
| `EXPO_PUBLIC_LOCK_ADVANCED_STAGES` | `1` = lock stages A–H (for future purchase/subscription gating) |

Local dev flow: run `npm run server:dev`, set `EXPO_PUBLIC_LOCAL_SOCKET_SERVER=1`, Expo Go on the same Wi-Fi auto-discovers your PC IP (same as Metro).

## Deploy targets

- **Multiplayer server**: Render blueprint. Build command `npm run build --prefix server`, start `node dist/server/src/index.js`. See `docs/deploy-render.md`.
- **Web app**: Render static site `salinda-web`.
- **Mobile (iOS/Android)**: EAS Build. Production env injected via `eas.json` (`EXPO_PUBLIC_SERVER_URL`, `EXPO_PUBLIC_WEB_APP_URL`).

## Repo layout (key folders)

```
card/
├── App.tsx, index.tsx          # app entry (index.tsx is the legacy big-screen)
├── GameScreen.tsx              # legacy top-level game screen
├── components/                 # shared UI (CardDesign, HorizontalOptionWheel, ...)
├── src/
│   ├── components/screens/     # modular screen components (newer)
│   ├── screens/                # LobbyScreens, etc.
│   ├── context/GameContext.tsx # global game state
│   ├── hooks/useMultiplayer.tsx
│   ├── theme/fonts.ts          # Fredoka font wiring
│   ├── types/game.ts
│   └── utils/deck.ts
├── shared/
│   ├── i18n/{en,he}.ts         # all copy goes through i18n
│   └── types.ts                # shared client/server types
├── server/src/                 # Socket.IO server
│   ├── index.ts
│   ├── socketHandlers.ts       # room + gameplay events (bulk of server logic)
│   ├── roomManager.ts
│   ├── gameEngine.ts
│   ├── deck.ts
│   └── equations.ts
├── assets/                     # branding, splash, sfx
├── scripts/                    # research + simulation scripts
│   ├── research-dice-enumeration.js
│   ├── research-exercise-space.js
│   ├── research-simulate-0-10-15.js
│   ├── simulate-lolos.js
│   └── simulate-variants.js
└── docs/
    ├── project-memory.md       # (this file)
    ├── bot-local-and-render-setup.md
    ├── deploy-render.md
    ├── RULE_CHANGE_SYMBOL_CHALLENGE.md
    ├── recommendations-deck-and-rules.md
    ├── rules-annex.md
    ├── simulation-report-3players.md
    ├── simulation-variants-report.md
    └── research/               # research outputs (JSON / HTML / PDF / PNG)
```

## Recent work themes (as of this snapshot)

- i18n pass (en + he), branding refresh, audio SFX, theme/fonts
- Multiplayer: opponent card counts fed from server `cardCount`; solid bot-vs-human flow
- Render deploy hardening: blueprint at repo root; server start script aligned to `dist/server/src/index.js`
- Lobby + start-screen: timer wheel, RTL defaults, fuse timer, stabilized overlays
- Game UI: stable header layout (sidebar + יציאה button), modal confirm button fixes
- Research: dice enumeration + exercise-space simulations for 0–10, 0–10–15, 0–12, 0–25 variants (outputs in `docs/research/`)

## Conventions / gotchas

- **All user-visible strings** go through `shared/i18n/{en,he}.ts` — do not hardcode copy.
- **RTL is the default** for Hebrew; test both directions when touching layout.
- **Socket event contracts** live in `shared/types.ts` — update both client (`src/hooks/useMultiplayer.tsx`) and server (`server/src/socketHandlers.ts`) together.
- **Server build path**: `tsc` outputs to `dist/server/src/index.js`. If you move files, update `server/package.json` start script and the Render blueprint.
- **Bot vs local vs Render**: if the bot button works locally but not on Render, the server on Render is out of date — redeploy. See `docs/bot-local-and-render-setup.md`.
- `.env` points to Render by default. To test against your local server, either blank `EXPO_PUBLIC_SERVER_URL` or set `EXPO_PUBLIC_LOCAL_SOCKET_SERVER=1`.
- Windows dev: line-ending warnings (LF → CRLF) are harmless.

## Useful commands

```bash
# client
npx expo start --clear        # dev
npm run web                   # web dev
npm run export:web            # static web build

# server
npm run server:dev            # dev (ts-node)
npm run server:build          # compile to dist/

# research / sims
node scripts/research-dice-enumeration.js
node scripts/research-exercise-space.js
node scripts/research-simulate-0-10-15.js
```

## External services

- **GitHub**: `itcohen2-maker/lolos-mobile` (main branch)
- **Render**: multiplayer server (`lolos-mobile.onrender.com`) + web (`salinda-web.onrender.com`)
- **EAS / Expo**: mobile builds (production env via `eas.json`)
