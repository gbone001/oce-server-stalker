# OCE Server Status Dashboard

A clean, modular React/TypeScript dashboard for monitoring OCE server status and player counts in real-time.

## Features

- **Real-time Monitoring**: Polls server APIs every 1 minute for up-to-date information
- **Comprehensive Display**: Shows server name, player counts (Allies/Axis), game time, scores (0-5 points), current map, and next map
- **Status Indicators**: Clear visual indicators for server status (online/offline) with error details
- **Last Refresh Timer**: Shows when data was last updated with manual refresh option
- **Dark Mode**: Toggle between light and dark themes with red and gold accent colors
- **Responsive Design**: Clean, simple interface that works on all devices
- **Modular Architecture**: Well-organized React/TypeScript components for easy maintenance

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gbone001/oce-server-status.git
   cd oce-server-status
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm start
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Configuration

### Updating Server List

Edit the `public/servers.json` file to add, remove, or modify servers:

```json
{
  "servers": [
    {
      "id": "unique-server-id",
      "name": "Display Name",
      "apiUrl": "https://api.example.com/server/status"
    }
  ]
}
```

**Server Configuration Fields:**
- `id`: Unique identifier for the server
- `name`: Display name shown in the dashboard
- `apiUrl`: API endpoint that returns server status data

### Expected API Response Format

Your server APIs should return JSON in the following format:

```json
{
  "alliesPlayers": 15,
  "axisPlayers": 12,
  "gameTime": "45:23",
  "alliesScore": 3,
  "axisScore": 2,
  "currentMap": "Carentan",
  "nextMap": "Foy"
}
```

**API Response Fields:**
- `alliesPlayers`: Number of players on Allies team
- `axisPlayers`: Number of players on Axis team
- `gameTime`: Current game time in MM:SS format
- `alliesScore`: Allies score (0-5 points)
- `axisScore`: Axis score (0-5 points)
- `currentMap`: Name of the currently active map
- `nextMap`: Name of the next map in rotation

### Customizing Polling Interval

To change how often the dashboard polls for updates, modify the `pollInterval` in `src/config/index.ts`:

```typescript
export const defaultConfig: AppConfig = {
  pollInterval: 60000, // 1 minute in milliseconds
  theme: {
    isDark: false
  }
};
```

### Customizing Colors and Branding

Update the color scheme in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#dc2626', // red accent
      gold: '#fbbf24',    // gold accent
    }
  }
}
```

Replace the ANZR logo by updating `public/anzr-logo.svg` with your own logo file.

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # App header with logo and theme toggle
│   ├── ServerTable.tsx # Main data display table
│   ├── StatusIndicator.tsx # Server status indicators
│   └── LastRefreshTimer.tsx # Refresh timer and manual refresh
├── hooks/              # Custom React hooks
│   ├── useTheme.ts     # Theme management
│   └── useServerData.ts # Data fetching and polling
├── services/           # Data services
│   └── ServerDataService.ts # API communication
├── types/              # TypeScript type definitions
│   └── index.ts        # All interface definitions
└── config/             # App configuration
    └── index.ts        # Default settings and constants
```

## Component Architecture

### Data Flow
1. **useServerData** hook loads server configuration from `servers.json`
2. Hook polls each server's API endpoint every minute
3. **ServerTable** component displays the aggregated data
4. **StatusIndicator** shows connection status for each server
5. **LastRefreshTimer** tracks and displays update timing

### Theme Management
- **useTheme** hook manages dark/light mode state
- Theme preference persisted in localStorage
- CSS classes applied to document root for global theming

### Error Handling
- Failed API calls show error status with details
- Mock data generation for development/demo purposes
- Graceful degradation when servers are unreachable

## Development

### Available Scripts

- `npm start`: Start development server
- `npm run build`: Build for production
- `npm test`: Run test suite
- `npm run deploy`: Deploy to GitHub Pages
- `npm run post-scoreboard`: _removed_ (use the Discord bot instead)

### Adding New Columns

To add new columns to the server table:

1. **Update the TypeScript interface** in `src/types/index.ts`:
   ```typescript
   export interface ServerStatus {
     // ... existing fields
     newField: string;
   }
   ```

2. **Update the API service** in `src/services/ServerDataService.ts` to handle the new field

3. **Add the column** to the table in `src/components/ServerTable.tsx`:
   ```tsx
   <th>New Field</th>
   // ... and in the table body:
   <td>{server.newField}</td>
   ```

## Deployment

### Deploy on Cloudflare Pages

- Connect this repository in Cloudflare → Workers & Pages → Create application → Pages.
- Build command: `npm ci && npm run build`
- Output directory: `build`
- Functions: auto-detected from `functions/api/[[path]].ts` (no wrangler.toml needed)
- Environment variables (Production):
  - `NODE_VERSION=18`
  - `ALLOWED_HOSTS=148.113.196.189:7010,145.223.22.23:7010,147.93.104.243:7010,154.26.158.99:7010`
  - Optional `TARGET_ORIGIN=http://148.113.196.189:7010`

Proxy behavior
- The app runs over HTTPS on Cloudflare Pages and automatically proxies any `http://` backend to `/api?target=<http-url>` on the same domain.
- The function validates the target against `ALLOWED_HOSTS` and returns the response with permissive CORS.

Note: The GitHub Pages deployment instructions below are deprecated now that this project targets Cloudflare Pages.

### GitHub Pages (gh-pages branch)

This project is configured to publish the production build to the `gh-pages` branch.

1) In GitHub: Settings → Pages
- Build and deployment → Source: Deploy from a branch
- Branch: `gh-pages` and Folder: `/` (root)

2) Locally, deploy the site:
```bash
npm install
npm run deploy
```
This builds the app and publishes `build/` to the `gh-pages` branch. The page will be served at:
`https://gbone001.github.io/oce-server-status`

Notes:
- `package.json:homepage` is already set for correct asset paths.
- Assets that use `process.env.PUBLIC_URL` (e.g., logo, `servers.json`) will resolve under the GitHub Pages subpath.

### GitHub Actions (manual runs and proxy env)

- Manually trigger a deploy: In GitHub → Actions → select the "Deploy to GitHub Pages" workflow → Run workflow (this uses workflow_dispatch).
- Configure proxy base for mixed-content avoidance:
  - Repo → Settings → Secrets and variables → Actions → Variables (preferred) or Secrets
  - Add `REACT_APP_PROXY_URL` with value `https://<your-pages-project>.pages.dev/api`
  - The workflow passes this env into the CRA build so HTTP APIs are routed through the Cloudflare proxy.

### Cloudflare Pages Proxy (to avoid mixed content)

If your server APIs are `http://` and your site runs on `https://` (GitHub Pages), enable the Cloudflare proxy and point the app at it:

- Deploy this same repo to Cloudflare Pages (auto-detects `functions/`)
- In Cloudflare Pages, set environment variables:
  - `ALLOWED_HOSTS`: comma-separated `host:port` list for your backends
  - Optional `TARGET_ORIGIN`: default backend for path-based proxy
- Build your GitHub Pages site with:
  - `REACT_APP_PROXY_URL=https://<your-pages-project>.pages.dev/api`

The app will route `http://` API calls through `REACT_APP_PROXY_URL?target=<http-url>` to avoid mixed content and CORS issues.

### Custom Domain

To use a custom domain, add a `CNAME` file to the `public/` directory with your domain name.

## Self-Hosting on a Host Port (No Cloudflare)

Run the dashboard directly on the host without Cloudflare Pages by serving the pre-built assets and using the bundled proxy.

1. Build the React app:
   ```bash
   npm run build
   ```
2. Start the host server (defaults to port `51823`):
   ```bash
   npm run start:host
   # optionally choose a different port
    PORT=5173 npm run start:host
   ```
3. Open `http://<host>:<port>/` in your browser.  
   The `/api` endpoint on this server forwards requests to the configured game server APIs, so no additional Cloudflare deployment is required.

## Discord Bot (Slash Commands)

Run the interval scoreboard bot directly with Discord.js.

1. Copy `.env.example` to `.env` and fill in `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`, and any optional settings.
2. Start the bot (registers slash commands and posts on the configured interval):
   ```bash
   npm run discord-bot
   ```
3. To adjust the frequency from Discord, use `/setfrequency <minutes>`; use `/stalknow` to trigger an immediate update.

For background operation, run the command with a process manager such as `pm2` or `systemd`, making sure it starts in the repository root so `.env` can be loaded.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
