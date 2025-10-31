# OCE Server Stalker Discord Bot

A lightweight Discord.js bot that monitors configured Hell Let Loose servers and posts scoreboard snapshots into a guild channel on a schedule. It also exposes slash commands so moderators can adjust the posting frequency or trigger an on-demand update.

## Features
- Periodic scoreboard posts with automatic chunking to stay under Discord’s message limits.
- `/setfrequency` slash command to update the posting cadence without redeploying.
- `/stalknow` slash command for an immediate scoreboard refresh.
- Optional role mention on the first message of each scoreboard batch.
- Configurable server list via `config/servers.json` or a custom `SERVERS_CONFIG_PATH`.

## Requirements
- Node.js 18.17 or newer.
- A Discord bot token with the `applications.commands` and `bot` scopes enabled.
- Channel ID and guild ID where the bot will be installed.

## Getting Started
1. **Clone the repository**
   ```bash
   git clone https://github.com/gbone001/oce-server-stalker.git
   cd oce-server-stalker
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Populate the required values:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `DISCORD_CHANNEL_ID`
   - Optional: `DISCORD_ROLE_ID`, `SCOREBOARD_INTERVAL_MINUTES`, `SERVERS_CONFIG_PATH`

4. **Configure tracked servers**
   Edit `config/servers.json` (or the file pointed to by `SERVERS_CONFIG_PATH`). Each entry supports:
   ```json
   {
     "name": "Display name shown in Discord",
     "url": "http://example.com:7010/api/get_public_info",
     "host": "optional.host.header",
     "statsUrl": "https://optional-link-used-in-replies"
   }
   ```
   `url` is required and should return the public Hell Let Loose server status JSON. `host`/`hostHeader` can be supplied when a reverse proxy requires it. `statsUrl` is forwarded unchanged in the scoreboard payload for downstream formatting.

## Running Locally
Start the bot with:
```bash
npm start
```

On first launch the bot registers its slash commands in the configured guild. It then posts the scoreboard immediately and sets up the interval defined by `SCOREBOARD_INTERVAL_MINUTES` (defaults to 5).

### Slash Commands
- `/setfrequency minutes:<int>` – update the posting interval (1–180 minutes).
- `/stalknow` – trigger an immediate scoreboard refresh. The bot acknowledges straight away and edits the ephemeral reply once the scoreboard is posted or if an error occurs.

## Deployment

### Railway
The included `railway.toml` builds the bot with `npm install --omit=dev` and starts it with `npm start`. Because the bot does not expose an HTTP server, disable any HTTP health checks the service may create automatically. Provide your environment variables (see `.env.example`) in the Railway dashboard and deploy.

### Other Platforms
Any Node-compatible process manager will work:
- **PM2** – `pm2 start scripts/discord-bot.js --name oce-server-stalker`
- **systemd** – point `ExecStart` at `node /path/to/scripts/discord-bot.js`

Ensure the working directory contains the `.env` (or that the relevant variables are exported).

## Configuration Reference

| Variable | Description |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Bot token from the Discord developer portal. |
| `DISCORD_GUILD_ID` | Guild (server) where slash commands will be registered. |
| `DISCORD_CHANNEL_ID` | Text channel where scoreboard updates are posted. |
| `DISCORD_ROLE_ID` | Optional role to mention on the first scoreboard message. |
| `SCOREBOARD_INTERVAL_MINUTES` | Posting frequency (defaults to 5). |
| `SERVERS_CONFIG_PATH` | Absolute or relative path to the servers JSON file (defaults to `config/servers.json`). |

## Development Notes
- The bot uses `undici` when the global `fetch` implementation is unavailable.
- Scoreboard messages are split across multiple Discord posts if they would exceed ~1800 characters.
- `config/servers.json` is the only persistent data the bot requires; feel free to mount or replace it per environment.

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
