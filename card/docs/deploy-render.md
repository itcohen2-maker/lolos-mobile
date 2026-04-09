# Deploy multiplayer server on Render

## Fix existing Web Service (`lolos-mobile`)

Open [service settings](https://dashboard.render.com/web/srv-d6umul1r0fns73bq0v60/settings) and set:

| Field | Value |
|--------|--------|
| **Root Directory** | `card/server` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` (runs `node dist/server/src/index.js` — not `dist/index.js`) |

Save, then **Manual Deploy → Clear build cache & deploy**.

This repo uses `card/server` (monorepo-style layout on `lolos-mobile`).

Verify: `GET https://lolos-mobile.onrender.com/` → JSON `{"status":"ok",...}`.

## Or: new service from Blueprint

`render.yaml` lives at the **repository root** (not inside `card/`). In Render: **Blueprints** → connect the repo.

Blueprint creates:

| Service | Purpose | Example URL |
|--------|---------|----------------|
| `lolos-multiplayer` | Node + Socket.io API | `https://lolos-multiplayer.onrender.com` |
| `salinda-web` | Static **Expo Web** (guest browser) | `https://salinda-web.onrender.com` |

If your existing API is already at `https://lolos-mobile.onrender.com`, leave that URL in `eas.json` / static-site env `EXPO_PUBLIC_SERVER_URL`, or point the static site’s build env to the host you actually use.

After the static site first deploys, verify:

- `GET https://salinda-web.onrender.com/` → HTML (Expo `index.html`), **not** JSON.
- Open `https://salinda-web.onrender.com/?room=1234&server=https://lolos-mobile.onrender.com` → lobby should pre-fill join (Web client).

Rebuild native production after URL changes: `eas build --platform all --profile production`.

## Client

Production builds read `EXPO_PUBLIC_SERVER_URL` from `eas.json`. Rebuild after changing the URL: `eas build --platform all --profile production`.

## Guest player in browser (no app install)

Host flow is now supported directly from the lobby:

1. Host creates room in the app.
2. In room lobby, host gets a "קישור אורח לדפדפן" and taps "שתף קישור".
3. Guest opens the link in browser, enters name, and joins.

Invite link format:

`https://<web-app-domain>?room=<ROOM_CODE>&server=<SOCKET_SERVER_URL>`

Required env values in app/web build environment:

- `EXPO_PUBLIC_SERVER_URL` = your Render socket server URL (example: `https://lolos-mobile.onrender.com`)
- `EXPO_PUBLIC_WEB_APP_URL` = your real published web client URL (must return the game UI, not 404). Set this after you deploy Expo Web; there is no universal default hostname.
