# BollyBrawl

Browser-based HTML, JavaScript and Three.js fighting game. Six fighters, three arenas (Film City Backlot, Dhobi Pachad Akhada and Cinema), CPU, training and two-player rooms.

## Hosting: Cloudflare Workers Builds (current deployment), no Docker required

The connected build runs `npx wrangler deploy`, which is Workers Builds, not Pages. The root `wrangler.jsonc` explicitly deploys the game from `dist/`, the room API and its SQLite-backed Durable Object together. No separate Worker deployment or manual ROOMS binding is needed in this mode.

- Root directory: repository root
- Deploy command: `npx wrangler deploy`
- Build command: may be blank; Wrangler runs `node build.mjs` automatically
- Worker name in the dashboard: `bollybrawl` (must match root Wrangler configuration)
- Production branch: `main`

If the dashboard Worker already has a different name, set `name` in root `wrangler.jsonc` to that existing Worker name before deployment. This does not change the website/game title. Custom domains are managed on that Worker's Settings → Domains & Routes.

The `functions/` adapter below is retained only for the alternative Pages deployment. Workers uses `cloudflare/site-worker.js` directly, so it does not need to migrate or auto-detect Pages Functions.

## Alternative: Cloudflare Pages

The browser downloads static JavaScript, textures, models and audio. There is no application server required for CPU or training. Docker is optional for running the included Node room server elsewhere; it is not required or used by Cloudflare Pages.

Connect `kartik1416/BollyBrawl`, production branch `main`:

- Framework: None
- Build command: `npm run build`
- Build output: `dist`
- Root directory: repository root
- Node: 22 or later

Root files are also directly deployable if the existing Pages project uses no build command and `/` as its output. The root `functions/` directory is deployed by Pages alongside the static build. The placeholder index is replaced by the game; the old test page is removed.

Every published asset is below Pages' 25 MiB per-file limit. The release uses local Draco WASM decoders, compressed models and MP3 entrance tracks. Original authoring models, original entrance WAVs and inspection files are excluded from Git and the build.

## Online room service on Cloudflare

Static Pages alone cannot run `server.mjs`. CPU and training work without a backend. For room codes, deploy the supplied authoritative room Worker once:

```sh
npx wrangler deploy --config cloudflare/wrangler.jsonc
```

Then in the Pages project, Settings → Bindings → Durable Object, add:

- Variable name: `ROOMS`
- Worker: `bollybrawl-rooms`
- Class: `BollyRoom`

Add the production binding (and preview binding if wanted), then redeploy Pages. Durable Objects must be deployed as a separate Worker before Pages can bind them. Until connected, the game gives an explicit online-service-unavailable message; CPU and training remain available. No Cloudflare API credential is stored in the repository.

Each code gets one room, two seats, authenticated WebSocket input and the same fixed-step combat simulation used locally. Disconnection pauses the match. Rooms expire after three hours. Tokens are temporary bearer credentials, not user accounts. The SQLite-backed Durable Object stores only the temporary room snapshot; it is not an analytics or match-history database. Active simulation consumes Worker resources; free-tier quotas apply.

## Do we need a database?

| Data | Current storage / requirement |
| --- | --- |
| Models, textures, portraits, audio | Static files on Pages; never put these binaries in SQL |
| CPU and training sessions | Browser memory; no database |
| Two-player room and current match | Room Worker / Durable Object shared state |
| Accounts, saved results, rankings, replay history | Not implemented; add D1 or another database only when these features are wanted |
| Future large media | R2 object storage if needed; not necessary for this release |

No persistent player tracking or analytics is enabled. Reloading CPU play starts a new session. For saved history later, record match IDs, player IDs, winner, score, arena and timestamps in a database, and keep large replay/media files in object storage.

## Local development

```sh
npm start
# http://localhost:4173
npm test
npm run build
```

The included Node server supports rooms locally and on a self-hosted Node host. On Pages, the room client instead uses the Durable Object WebSocket transport. Test the Cloudflare backend with:

```sh
npx wrangler dev --config cloudflare/wrangler.jsonc
node cloudflare/rooms.test.mjs
```

## Assets

User-provided characters, reference art and audio are included as supplied/derived assets. Their inclusion does not grant third-party likeness, music or trademark rights. Material and font license/attribution files are retained in their asset folders. Three.js and Draco licenses are under `vendor/`. All three arenas are generated from the game's authored scene geometry rather than the removed Braithwaite scan.

## Media editor

Open `/admin` on the deployed Worker and sign in with the Admin credentials supplied for this installation. The password is verified server-side with a salted PBKDF2 verifier; no plaintext password is in the browser bundle. Sessions use an HttpOnly cookie and expire after eight hours. Login attempts are rate limited and mutation requests require the same origin.

Select an audio or image slot, choose a replacement, preview it and click **Save replacement**. **Restore original** removes the override. Supported files: MP3/WAV/OGG and PNG/JPEG/WebP, up to 8 MB per slot. SVG/HTML uploads are not accepted. Updates apply when players next reload the game. Model GLBs and skeletons cannot be replaced through this editor.

Uploads and slot settings persist in the `CONTENT` SQLite-backed Durable Object; migration `v2` provisions it with the normal Worker deployment. There is no additional R2 or D1 setup for these bounded media slots. Large media libraries should move to object storage later. The Pages-only adapter does not currently include this editor backend; use the root Worker deployment.

Character templates now load through a queue with four download/decode attempts, download timeouts and GLB validation. Existing previews remain visible until the requested pair is ready, and the fighter roster warms its cache in the background. A permanent network outage can still prevent new downloads, but transient requests no longer fail on the first interruption.

Editor backend integration check (against local Wrangler):

```sh
CONTENT_TEST_URL=http://127.0.0.1:8802 ADMIN_TEST_PASSWORD=<configured-password> node cloudflare/content.test.mjs
```
