# BollyBrawl

Browser-based HTML, JavaScript and Three.js fighting game. Six fighters, three arenas (Film City Backlot, Dhobi Pachad Akhada and Cinema), CPU, training and two-player rooms.

## Hosting: Cloudflare Pages, no Docker required

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
