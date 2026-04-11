# Bot Game Setup

## Local Test
1. In the repo root, run `npm run server:dev`.
2. In `.env`, temporarily set `EXPO_PUBLIC_SERVER_URL=http://localhost:3001`.
3. Restart Expo with `npx expo start --clear`.
4. Create an online room.
5. Press `התחל מול בוט`.

If the bot game starts locally, the client flow is fine and the remaining issue is deployment.

## Render Deploy
The bot button needs the updated Socket.IO server, not just the app UI.

Deploy these server-side changes:
- `server/src/socketHandlers.ts`
- `server/src/roomManager.ts`
- `server/src/gameEngine.ts`
- `shared/types.ts`

Then redeploy the mobile/web client if needed so the UI and server use the same event contract.

## Important Check
If `.env` points to:

`EXPO_PUBLIC_SERVER_URL=https://lolos-mobile.onrender.com`

then your app is talking to Render, not to your local server.

## Quick Diagnosis
- Button does nothing locally: client-side issue.
- Button works locally but not on Render: server on Render is outdated.
