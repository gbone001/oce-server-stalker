This repository is a small React + TypeScript dashboard (CRA via craco) that polls Battlefield-style game servers and optionally proxies requests via Cloudflare Pages functions or a lightweight Express host.

Key goal for an agent: make safe, minimal, discoverable changes (bug fixes, small features, tests) and follow the app's conventions around config, proxying, and runtime environment.

Quick overview (big picture)
- Frontend: React + TypeScript (src/) — components in `src/components`, hooks in `src/hooks`, service layer in `src/services`.
- Data flow: `useServerData` reads `public/servers.json` (via `ServerDataService.fetchServersConfig`) and repeatedly polls each server's `apiUrl` using `ServerDataService.fetchServerStatus`.
- Proxying: If the frontend needs to call `http://` APIs from `https://`, it routes via either:
  - Cloudflare Pages Function `functions/api/[[path]].ts` (recommended for Pages), or
  - Local host proxy `server/host-server.js` when running `npm run start:host` (serves build/ and forwards `/api?target=...`).

Important files to reference when coding
- `package.json` — scripts: `npm start`, `npm run build`, `npm test`, `npm run discord-bot`, `npm run start:host` (host server).
- `functions/api/[[path]].ts` — reverse-proxy function. Check `ALLOWED_HOSTS`, `ALLOW_ALL_TARGETS`, and `TARGET_ORIGIN` env vars before changing behavior.
- `server/host-server.js` — express host/proxy used for self-hosting. Uses Node 18+ fetch (falls back to `undici`).
- `src/services/ServerDataService.ts` — canonical place for API mapping, normalization, validation, and proxy URL logic (`toProxiedUrl`, `unwrapApiResponse`, `mapApiResponseToStatus`).
- `src/hooks/useServerData.ts` — polling, lifecycle, and error handling. `defaultConfig.pollInterval` controls timing in `src/config/index.ts`.
- `public/servers.json` — canonical server list; may be either an array (legacy) or `{ servers: [...] }` object.
- `src/types/index.ts` — central type definitions (ServerConfig, ServerStatus, ServersConfig, AppConfig).

Conventions & patterns (concrete, repo-specific)
- Servers config acceptance: `ServerDataService.validateServersConfig` accepts either a plain array of `{name,url}` entries or an object with `{ servers: [...] }`. When adding servers in code or tests prefer the object format with explicit `id` and `apiUrl`.
- API responses: the service is deliberately permissive — it attempts multiple key names (e.g. `alliesPlayers`, `allies_count`, `players.allies`) and unwraps `{ result: ... }` wrappers. When adding mapping logic, follow the same tolerant approach and add unit tests for new cases.
- Proxy URL construction: prefer using `REACT_APP_PROXY_URL` in env for production HTTPS->HTTP proxying. In dev the app may call APIs directly.
- Timeouts and aborts: `fetchServerStatus` uses an 8s timeout; host proxy uses 10s. Keep network timeouts conservative and add graceful fallback statuses.

Build / test / debug workflows (commands and tips)
- Dev UI: `npm install` then `npm start` (runs craco/CRA dev server).
- Build: `npm run build` (produces `build/`). `server/host-server.js` requires `build/` to exist — run `npm run build` before `npm run start:host`.
- Self-host: `npm run start:host` — serves the `build/` static site and provides `/api?target=` proxy.
- Cloudflare Pages: the function in `functions/api/[[path]].ts` is used; env vars (`ALLOWED_HOSTS`, `TARGET_ORIGIN`, `ALLOW_ALL_TARGETS`) control allowed proxy targets.
- Discord bot: `npm run discord-bot` (reads `.env`). Use a process manager for background runs.
- Tests: `npm test` (CRA test runner via craco).

Testing & safety guidance for agents
- Run existing tests before modifying behavior. Keep changes local and small. If adding new behavior that touches network or proxying, add unit tests for `ServerDataService` mapping and `validateServersConfig`.
- Avoid committing secrets. Environment variables and tokens should be described in repository docs or `.env.example` and never committed.

Examples the agent can use directly
- To add a new field mapping, update `mapApiResponseToStatus` in `src/services/ServerDataService.ts` and add a test that feeds a sample JSON shape and asserts the mapped `ServerStatus`.
- To change poll rate, update `defaultConfig.pollInterval` in `src/config/index.ts`.
- To add a new server for local testing, edit `public/servers.json` using the object form:
  { "servers": [{ "id": "anzr-1", "name": "ANZR", "apiUrl": "http://148.113.196.189:7010/api/get_public_info" }] }

When to touch the function or host server
- Modify `functions/api/[[path]].ts` only for proxy-related fixes (CORS, header forwarding, allowlist logic). The frontend service expects permissive CORS from the proxy.
- Modify `server/host-server.js` for changes to self-hosting or allowed-host preloading (it reads `public/servers.json` to seed allowed hosts).

If something is unclear
- Ask for the preferred deployment target (Cloudflare Pages vs self-host) and whether `ALLOWED_HOSTS` should be expanded or `ALLOW_ALL_TARGETS` used for testing. Also confirm desired Node engine if changing host code (package.json requires Node >=18.17).

Please review and tell me which area to improve or expand (tests, CI, deployment steps).
