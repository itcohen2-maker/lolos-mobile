# Deploy multiplayer server on Render

## Fix existing Web Service (`lolos-mobile`)

Open [service settings](https://dashboard.render.com/web/srv-d6umul1r0fns73bq0v60/settings) and set:

| Field | Value |
|--------|--------|
| **Root Directory** | `server` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

Save, then **Manual Deploy → Clear build cache & deploy**.

If `package.json` is not at `server/` in GitHub (e.g. code is under `card/server`), use that path as Root Directory instead.

Verify: `GET https://lolos-mobile.onrender.com/` → JSON `{"status":"ok",...}`.

## Or: new service from Blueprint

Commit `render.yaml`, then in Render: **Blueprints** → connect the repo. You get a URL like `https://lolos-multiplayer.onrender.com` — set `EXPO_PUBLIC_SERVER_URL` in `eas.json` (production env) to match.

## Client

Production builds read `EXPO_PUBLIC_SERVER_URL` from `eas.json`. Rebuild after changing the URL: `eas build --platform all --profile production`.
