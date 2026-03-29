const fs = require('fs/promises');
const path = require('path');

let fetchImpl = globalThis.fetch;
if (typeof fetchImpl !== 'function') {
  try {
    ({ fetch: fetchImpl } = require('undici'));
  } catch (err) {
    throw new Error(
      'Global fetch is unavailable and undici could not be loaded. Install Node.js 18+ or add the undici dependency.'
    );
  }
}

const fetch = (...args) => fetchImpl(...args);

const CONFIG_ENV_PATH = process.env.SERVERS_CONFIG_PATH;
const DEFAULT_CONFIG_PATHS = [
  path.join(__dirname, '..', 'config', 'servers.json'),
  path.join(__dirname, '..', 'public', 'servers.json'),
];

function formatPathLabel(value) {
  const relative = path.relative(process.cwd(), value);
  return relative && !relative.startsWith('..') ? relative : value;
}

async function resolveConfigPath() {
  if (CONFIG_ENV_PATH) {
    return path.resolve(CONFIG_ENV_PATH);
  }

  for (const candidate of DEFAULT_CONFIG_PATHS) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        throw new Error(`Unable to access ${formatPathLabel(candidate)}: ${err.message}`);
      }
    }
  }

  throw new Error(
    'Unable to locate servers configuration. Provide config/servers.json or set SERVERS_CONFIG_PATH.'
  );
}

async function loadServersConfig() {
  const configPath = await resolveConfigPath();
  const label = formatPathLabel(configPath);

  let rawText;
  try {
    rawText = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    throw new Error(`Unable to read ${label}: ${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`${label} contains invalid JSON: ${err.message}`);
  }

  if (Array.isArray(data)) {
    const list = data.map((entry, index) => normalizeArrayEntry(entry, index, label));
    return list.filter((s) => !s.hidden);
  }

  if (!data || typeof data !== 'object') {
    throw new Error(`${label} must contain an array or an object with a "servers" array.`);
  }

  if (!Array.isArray(data.servers)) {
    throw new Error(`${label}: object format requires a "servers" array`);
  }

  const mapped = data.servers.map((entry, index) => normalizeObjectEntry(entry, index, label));
  return mapped.filter((s) => !s.hidden);
}

function normalizeArrayEntry(entry, index, label) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`${label}[${index}] must be an object`);
  }
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const url = typeof entry.url === 'string' ? entry.url.trim() : '';
  const statsUrl =
    typeof entry.statsUrl === 'string' && entry.statsUrl.trim().length > 0 ? entry.statsUrl.trim() : undefined;
  const hostHeader =
    typeof entry.host === 'string'
      ? entry.host.trim()
      : typeof entry.hostHeader === 'string'
        ? entry.hostHeader.trim()
        : undefined;
  const alias = typeof entry.alias === 'string' && entry.alias.trim().length > 0 ? entry.alias.trim() : undefined;
  if (!name || !url) {
    throw new Error(`${label}[${index}] requires non-empty "name" and "url" fields`);
  }
  return {
    id: slugify(name) || `server-${index + 1}`,
    name,
    apiUrl: url,
    hostHeader,
    alias,
    statsUrl,
    hidden: entry && typeof entry.hidden === 'boolean' ? Boolean(entry.hidden) : false,
  };
}

function normalizeObjectEntry(entry, index, label) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`${label}.servers[${index}] must be an object`);
  }
  const { id, name, apiUrl, hostHeader, host, statsUrl, alias } = entry;
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error(`${label}.servers[${index}].id must be a non-empty string`);
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(`${label}.servers[${index}].name must be a non-empty string`);
  }
  if (typeof apiUrl !== 'string' || !apiUrl.trim()) {
    throw new Error(`${label}.servers[${index}].apiUrl must be a non-empty string`);
  }
  const hostOverride =
    typeof hostHeader === 'string' && hostHeader.trim()
      ? hostHeader.trim()
      : typeof host === 'string' && host.trim()
        ? host.trim()
        : undefined;
  return {
    id: id.trim(),
    name: name.trim(),
    apiUrl: apiUrl.trim(),
    hostHeader: hostOverride,
    alias: typeof alias === 'string' && alias.trim().length > 0 ? alias.trim() : undefined,
    statsUrl: typeof statsUrl === 'string' && statsUrl.trim().length > 0 ? statsUrl.trim() : undefined,
    hidden: typeof entry.hidden === 'boolean' ? Boolean(entry.hidden) : false,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function fetchServerStatuses() {
  const servers = await loadServersConfig();
  const results = [];
  for (const server of servers) {
    const result = await fetchServerStatus(server);
    results.push(result);
  }
  return results;
}

async function fetchServerStatus(server) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = { Accept: 'application/json' };
    if (server.hostHeader) {
      headers.Host = server.hostHeader;
    }
    const res = await fetch(server.apiUrl, { signal: controller.signal, headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    let raw;
    try {
      raw = await res.json();
    } catch (err) {
      throw new Error(`Invalid JSON response: ${err.message}`);
    }

    const payload = unwrapApiResponse(raw);
    let serverUrlBase = '';
    try { serverUrlBase = new URL(server.apiUrl).origin; } catch {}
    return {
      ...mapApiResponse(payload, server),
      status: 'success',
      alias: server.alias,
      statsUrl: server.statsUrl,
      serverUrlBase,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      id: server.id,
      name: server.name,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      alias: server.alias,
      statsUrl: server.statsUrl,
      serverUrlBase: (() => { try { return new URL(server.apiUrl).origin; } catch { return undefined; } })(),
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapApiResponse(data) {
  if (data && typeof data === 'object' && data.result && typeof data.result === 'object') {
    return data.result;
  }
  return data;
}

function mapApiResponse(data, server) {
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const optionalStr = (v) => (typeof v === 'string' && v.trim().length > 0 ? v : undefined);
  const toTime = (seconds) => {
    const value = num(seconds, undefined);
    if (typeof value !== 'number') return null;
    return Math.max(0, Math.round(value));
  };

  const alliesPlayers =
    num(data?.alliesPlayers, undefined) ??
    num(data?.allies_count, undefined) ??
    num(data?.players?.allies, undefined) ??
    num(data?.player_count_by_team?.allied, undefined) ??
    num(data?.playerCountAllies, undefined) ??
    0;

  const axisPlayers =
    num(data?.axisPlayers, undefined) ??
    num(data?.axis_count, undefined) ??
    num(data?.players?.axis, undefined) ??
    num(data?.player_count_by_team?.axis, undefined) ??
    num(data?.playerCountAxis, undefined) ??
    0;

  const totalPlayers =
    num(data?.player_count, undefined) ?? num(data?.players_total, undefined) ?? alliesPlayers + axisPlayers;

  const alliesScore =
    num(data?.alliesScore, undefined) ??
    num(data?.score?.allied, undefined) ??
    num(data?.score?.allies, undefined) ??
    num(data?.allies_score, undefined) ??
    0;

  const axisScore =
    num(data?.axisScore, undefined) ?? num(data?.score?.axis, undefined) ?? num(data?.axis_score, undefined) ?? 0;

  const currentMap =
    optionalStr(data?.currentMap) ??
    optionalStr(data?.current_map?.map?.pretty_name) ??
    optionalStr(data?.current_map?.pretty_name) ??
    optionalStr(data?.current_map?.map?.name) ??
    optionalStr(data?.current_map?.name) ??
    optionalStr(data?.current_map?.map?.id) ??
    'Unknown';

  const nextMap =
    optionalStr(data?.nextMap) ??
    optionalStr(data?.next_map?.map?.pretty_name) ??
    optionalStr(data?.next_map?.pretty_name) ??
    optionalStr(data?.next_map?.map?.name) ??
    optionalStr(data?.next_map?.name) ??
    optionalStr(data?.next_map?.map?.id) ??
    optionalStr(data?.nextMapName) ??
    'Unknown';

  const shortName =
    optionalStr(data?.short_name) ??
    optionalStr(data?.shortName) ??
    optionalStr(data?.name?.short_name) ??
    optionalStr(data?.name?.shortName) ??
    undefined;

  return {
    id: server.id,
    name: server.name,
    shortName,
    totalPlayers,
    alliesPlayers,
    axisPlayers,
    alliesScore,
    axisScore,
    currentMap,
    nextMap,
    timeRemainingSeconds: toTime(num(data?.time_remaining, undefined) ?? num(data?.remaining_time, undefined)),
  };
}

function formatSeconds(value) {
  if (typeof value !== 'number') {
    return '--:--';
  }
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatRelativeFromIso(iso) {
  try {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return '--';
    const now = new Date();
    let diff = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000)); // seconds
    if (diff === 0) return '<1s ago';
    const days = Math.floor(diff / 86400); diff -= days * 86400;
    const hours = Math.floor(diff / 3600); diff -= hours * 3600;
    const minutes = Math.floor(diff / 60); diff -= minutes * 60;
    const seconds = diff;
    if (days > 0) return `${days}d ${hours}h ago`;
    if (hours > 0) return `${hours}h ${minutes}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds}s ago`;
    return `${seconds}s ago`;
  } catch {
    return '--';
  }
}

function safeUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return '-';
  return value.trim();
}

const SCOREBOARD_TITLE = 'OCE Server Stalker';

function titleCase(value) {
  return value.replace(/\b([a-z])/g, (match, ch) => ch.toUpperCase());
}

function toMapShortName(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Unknown';
  let text = value.trim();
  if (/[_]/.test(text)) {
    text = text.replace(/_(warfare|offensive|skirmish)$/i, '');
    text = text.replace(/_/g, ' ');
    return titleCase(text);
  }
  text = text.replace(/\s+(Warfare|Offensive|Skirmish)\s*$/i, '');
  if (/^unknown(\s+warfare)?\b/i.test(text)) return 'Unknown';
  return text;
}

function getPreferredServerName(status) {
  const serverName = status.name ? String(status.name) : 'Unknown';
  if (status.alias) return String(status.alias);
  if (status.shortName) return String(status.shortName);
  return serverName;
}

function getTotalPlayers(status) {
  if (typeof status.totalPlayers === 'number') {
    return status.totalPlayers;
  }
  return (status.alliesPlayers ?? 0) + (status.axisPlayers ?? 0);
}

function getServerRank(status) {
  if (status.status !== 'success') return -1;
  return getTotalPlayers(status);
}

function getServerStateLabel(status) {
  if (status.status !== 'success') {
    return 'OFFLINE';
  }

  const totalPlayers = getTotalPlayers(status);
  if (totalPlayers >= 90) return 'HOT';
  if (totalPlayers >= 70) return 'LIVE';
  if (totalPlayers >= 35) return 'WARM';
  return 'SEEDING';
}

function buildServerBlock(status) {
  const preferredName = getPreferredServerName(status);
  const updated = formatRelativeFromIso(status.fetchedAt);

  if (status.status !== 'success') {
    return [
      `**${preferredName}**  [OFFLINE]`,
      `Error: ${status.error || 'Unavailable'}`,
      `Seen: ${updated}`,
    ].join('\n');
  }

  const currentMap = toMapShortName(status.currentMap || 'Unknown');
  const nextMap = toMapShortName(status.nextMap || 'Unknown');
  const totalPlayers = getTotalPlayers(status);
  const alliesPlayers = status.alliesPlayers ?? 0;
  const axisPlayers = status.axisPlayers ?? 0;
  const alliesScore = status.alliesScore ?? 0;
  const axisScore = status.axisScore ?? 0;
  const summaryLine = [currentMap, `${totalPlayers} players`];
  const matchLine = [`A/X ${alliesPlayers}-${axisPlayers}`, `Score ${alliesScore}-${axisScore}`];

  if (typeof status.timeRemainingSeconds === 'number') {
    matchLine.push(`${formatSeconds(status.timeRemainingSeconds)} left`);
  }

  const lines = [
    `**${preferredName}**  [${getServerStateLabel(status)}]`,
    summaryLine.join(' | '),
    matchLine.join(' | '),
    `Next: ${nextMap}`,
  ];

  lines.push(`Seen: ${updated}`);
  return lines.join('\n');
}

function buildDiscordMessage(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return `**${SCOREBOARD_TITLE}**\nNo servers configured.`;
  }

  const orderedStatuses = [...statuses].sort((left, right) => {
    const rankDiff = getServerRank(right) - getServerRank(left);
    if (rankDiff !== 0) return rankDiff;
    return getPreferredServerName(left).localeCompare(getPreferredServerName(right));
  });

  const blocks = orderedStatuses.map(buildServerBlock);
  return `**${SCOREBOARD_TITLE}**\n\n${blocks.join('\n\n')}`;
}

function buildDiscordMessages(statuses, maxLen = 1800) {
  const message = buildDiscordMessage(statuses);
  if (message.length <= maxLen) {
    return [message];
  }

  const blocks = Array.isArray(statuses) && statuses.length > 0
    ? [...statuses]
        .sort((left, right) => {
          const rankDiff = getServerRank(right) - getServerRank(left);
          if (rankDiff !== 0) return rankDiff;
          return getPreferredServerName(left).localeCompare(getPreferredServerName(right));
        })
        .map(buildServerBlock)
    : ['No servers configured.'];

  const header = `**${SCOREBOARD_TITLE}**`;
  const chunks = [];
  let current = header;

  for (const block of blocks) {
    const separator = current === header ? '\n\n' : '\n\n';
    const candidate = `${current}${separator}${block}`;
    if (candidate.length > maxLen && current !== header) {
      chunks.push(current);
      current = `${header}\n\n${block}`;
      continue;
    }
    current = candidate;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

module.exports = {
  loadServersConfig,
  fetchServerStatuses,
  buildDiscordMessage,
  buildDiscordMessages,
  SCOREBOARD_TITLE,
  formatSeconds,
};
