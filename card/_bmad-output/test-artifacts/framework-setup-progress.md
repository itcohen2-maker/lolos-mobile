---
stepsCompleted:
  - step-01-preflight
  - step-02-select-framework
  - step-03-scaffold-framework
  - step-04-docs-and-scripts
  - step-05-validate-and-summary
lastStep: step-05-validate-and-summary
lastSaved: '2026-04-16'
---

# Framework Setup Progress

## Step 1 — Preflight ✓

- **Stack:** fullstack (Expo web + Express/Socket.io)
- **package.json:** present
- **Existing E2E:** none (Jest unit-only)
- **Web build:** `expo export --platform web` via react-native-web

## Step 2 — Framework Selection ✓

**Choice:** Playwright

**Why:**
- Multi-context support (two browser contexts in one test) → multiplayer testing without spinning up two CI runners
- Native Socket.io fixtures via test fixtures
- Built-in JUnit + HTML + GitHub reporters → no plugin glue
- Mobile viewport projects (Pixel 7, iPhone 14) → catch mobile web layout regressions in same run

## Step 3 — Scaffold ✓

| Path | Purpose |
|---|---|
| `playwright.config.ts` | 4 projects (chromium, firefox, mobile-chrome, mobile-safari), `webServer` auto-boots `npm run web` |
| `tests/e2e/` | 4 spec files (smoke, tutorial, bot-game, multiplayer) |
| `tests/support/fixtures/index.ts` | `mergeTests` with lobby/game/tutorial/player/roomCode fixtures |
| `tests/support/fixtures/factories.ts` | Player + room code factories |
| `tests/support/helpers/network.ts` | Console-error guard, socket connection wait |
| `tests/support/helpers/locale.ts` | Set `lang` localStorage, RTL/LTR assertions |
| `tests/support/page-objects/` | LobbyPage, GamePage, TutorialPage |
| `tests/.env.example` | BASE_URL, SOCKET_URL, SKIP_WEB_SERVER |
| `.nvmrc` | `20` |

## Step 4 — Docs & Scripts ✓

- `tests/README.md` — quick start, conventions, required `data-testid` table per page object, troubleshooting
- `package.json` scripts: `test:e2e`, `test:e2e:headed`, `test:e2e:debug`, `test:e2e:ui`, `test:e2e:report`
- `.gitignore` updated: `playwright-report/`, `test-results/`, `tests/results/`, `tests/.env`
- `.github/workflows/e2e.yml` — push/PR triggers, uploads HTML report + JUnit artifacts

## Step 5 — Validation ✓

| Check | Status |
|---|---|
| Preflight passed | ✓ |
| Directory structure created | ✓ |
| Config compiles (`npx playwright test --list`) | ✓ — 20 tests across 4 projects |
| Fixtures + factories created | ✓ |
| Sample tests demonstrate Given/When/Then + data-testid + factories | ✓ |
| README + npm scripts present | ✓ |
| CI pipeline present | ✓ |
| Browsers installed (chromium, firefox) | ✓ |

## Next steps for the developer

1. **Add `data-testid` attributes** in app code per the table in `tests/README.md`. Without these, tests will fail with locator timeouts.
2. **Run smoke first:** `npm run test:e2e -- tests/e2e/smoke.spec.ts --project=chromium`
3. **Iterate locally with UI mode:** `npm run test:e2e:ui` (best DX)
4. **For multiplayer tests:** start the server (`npm run server:dev`) and run with `RUN_MULTIPLAYER=1`

## Knowledge fragments applied

- `fixtures-composition` — `mergeTests` pattern for cross-cutting fixtures
- `data-factories` — typed factories with overrides + monotonic IDs
- `network-error-monitor` — console-error guard helper
- `playwright-config` — retain-on-failure traces, action/navigation timeout split, CI-aware reporters
