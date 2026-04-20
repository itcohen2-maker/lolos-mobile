# E2E Tests (Playwright)

End-to-end browser tests for the Expo web build of the card game.

> **Scope:** Web only. Native iOS/Android targets are not covered here — use Detox or Maestro for native E2E.

## Quick start

```bash
# 1. Install browsers (first time only)
npx playwright install chromium firefox

# 2. Run all tests (boots `npm run web` automatically)
npm run test:e2e

# 3. Open the HTML report
npm run test:e2e:report
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run test:e2e` | Headless run, all projects |
| `npm run test:e2e:headed` | See the browser while tests run |
| `npm run test:e2e:debug` | Step through with Playwright Inspector |
| `npm run test:e2e:ui` | Interactive UI mode (best DX) |
| `npx playwright test tests/e2e/smoke.spec.ts` | One file |
| `npx playwright test --project=chromium` | One browser |

## Architecture

```
tests/
├── e2e/                    Test specs (*.spec.ts)
│   ├── smoke.spec.ts
│   ├── tutorial.spec.ts
│   ├── bot-game.spec.ts
│   └── multiplayer.spec.ts
├── support/
│   ├── fixtures/
│   │   ├── index.ts        Custom test() with merged fixtures
│   │   └── factories.ts    Test data factories (player, room code)
│   ├── helpers/
│   │   ├── network.ts      Console-error guard, socket wait
│   │   └── locale.ts       Set he/en + RTL assertions
│   └── page-objects/
│       ├── LobbyPage.ts
│       ├── GamePage.ts
│       └── TutorialPage.ts
└── README.md               This file
```

## Conventions

- **Selectors:** `data-testid` only — avoid CSS class or text selectors that break across i18n.
- **Format:** Given/When/Then in test titles for readability.
- **Isolation:** Each test owns its own page; no shared state across tests.
- **Network failures:** Use `failOnConsoleError(page)` at the top of any test that should remain console-clean.
- **Multiplayer tests:** Gated on `RUN_MULTIPLAYER=1` — they need the Socket.io server running on `SOCKET_URL`.

## Required `data-testid`s in app code

The page objects expect these test IDs. If a test fails because the locator can't find them, either add the testid to the component or update the page object.

| Page Object | testid | Component (suggested) |
|---|---|---|
| LobbyPage | `lobby-tutorial`, `lobby-play-bot`, `lobby-create-room`, `lobby-join-room`, `lobby-language-toggle` | `src/screens/LobbyScreens.tsx` |
| GamePage | `player-hand`, `opponent-hand`, `equation-area`, `dice-area`, `end-turn`, `roll-dice`, `card-{value}` | `GameScreen.tsx` |
| TutorialPage | `tutorial-next`, `tutorial-prev`, `tutorial-skip`, `tutorial-step-indicator`, `tutorial-narration` | `src/tutorial/TutorialGameScreen.tsx` |

## Environment

Copy `tests/.env.example` → `tests/.env` and adjust:

- `BASE_URL` — Expo web URL (default `http://localhost:8081`)
- `API_URL` / `SOCKET_URL` — game server (default `http://localhost:3001`)
- `SKIP_WEB_SERVER=1` — disable auto-boot of `npm run web` (use when you already have it running)

## CI

`.github/workflows/e2e.yml` runs on push to main and all PRs. Reports and JUnit results upload as artifacts.

## Troubleshooting

- **First run is slow:** Expo bundles ~600KB of JS — give the `webServer` block its 180s timeout.
- **Tests time out waiting for the lobby:** Make sure `npm run web` works standalone first.
- **Native-only code fails to load:** Components using native-only APIs (e.g., `expo-screen-orientation`) may need web fallbacks. Wrap with `Platform.OS === 'web'` checks.
