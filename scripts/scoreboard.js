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
  if (!name || !url) {
    throw new Error(`${label}[${index}] requires non-empty "name" and "url" fields`);
  }
  return {
    id: slugify(name) || `server-${index + 1}`,
    name,
    apiUrl: url,
    hostHeader,
    statsUrl,
    hidden: entry && typeof entry.hidden === 'boolean' ? Boolean(entry.hidden) : false,
  };
}

function normalizeObjectEntry(entry, index, label) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`${label}.servers[${index}] must be an object`);
  }
  const { id, name, apiUrl, hostHeader, host, statsUrl } = entry;
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
    return {
      ...mapApiResponse(payload, server),
      status: 'success',
      statsUrl: server.statsUrl,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      id: server.id,
      name: server.name,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      statsUrl: server.statsUrl,
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

function buildDiscordMessage(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return 'No servers configured.';
  }

  // Requested columns:
  // Server - Current Map Match Score - Total Players - Allies vs Axis - Next Map - Detailed Stats Link - Last Updated
  const headers = [
    'Server',
    'Map/Score',
    'Tot',
    'A/A',
    'Next',
    'Stats',
    'Updated',
  ];

  const truncate = (val, max) => {
    const s = typeof val === 'string' ? val : String(val ?? '');
    if (s.length <= max) return s;
    if (max <= 1) return s.slice(0, max);
    return s.slice(0, Math.max(0, max - 1)) + '…';
  };

  const shortStats = (url) => {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}`; // clickable, compact
    } catch {
      return safeUrl(url);
    }
  };
  const rows = statuses.map((status) => {
  const serverName = status.name ? String(status.name) : 'Unknown';
  const preferredName = status.shortName ? String(status.shortName) : serverName;
  const withShort = truncate(preferredName, 26);

    const isOk = status.status === 'success';
  const currentMap = isOk ? (status.currentMap || 'Unknown') : (status.error || 'Offline');
  const matchScore = isOk ? `${status.alliesScore ?? 0}-${status.axisScore ?? 0}` : 'ERR';
  const mapScore = truncate(`${currentMap} ${matchScore}`, 22);
    const total = isOk
      ? (typeof status.totalPlayers === 'number'
          ? status.totalPlayers
          : (status.alliesPlayers ?? 0) + (status.axisPlayers ?? 0))
      : 0;
    const alliesVsAxis = isOk
      ? `${status.alliesPlayers ?? 0}-${status.axisPlayers ?? 0}`
      : '0-0';
    const nextMap = truncate(isOk ? (status.nextMap || 'Unknown') : '', 16);
    const statsLink = shortStats(status.statsUrl);
  const updated = formatRelativeFromIso(status.fetchedAt);

    return [
      withShort,
      mapScore,
      String(total),
      alliesVsAxis,
      nextMap,
      statsLink,
      updated,
    ];
  });

  const widths = headers.map((header, index) => {
    const colValues = rows.map((row) => row[index] ?? '');
    return Math.max(header.length, ...colValues.map((value) => value.length));
  });

  const renderRow = (row) =>
    row
      .map((value, index) => {
        const cell = value ?? '';
        return cell.padEnd(widths[index], ' ');
      })
      .join(' | ');

  const separator = widths.map((width) => '-'.repeat(width)).join('-|-');
  const output = [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');

  return ['```', output, '```'].join('\n');
}

// 4) NEW: multi-message splitter (keeps header per chunk, wraps each chunk in its own ``` fence)
function buildDiscordMessages(statuses, maxLen = 1800) {
  const full = buildDiscordMessage(statuses);
  if (full.length <= maxLen) return [full];

  // We need to split by rows but keep header/separator on every chunk.
  const lines = full.split('\n');
  if (lines.length < 5) return [full]; // unexpected, just return as-is

  // lines[0] = "```", lines[1] = header, lines[2] = sep, ..., lines[last] = "```"
  const headerFenceStart = lines[0];
  const headerLine = lines[1];
  const sepLine = lines[2];
  const fenceEnd = lines[lines.length - 1];
  const dataRows = lines.slice(3, -1);

  const chunks = [];
  let current = [headerFenceStart, headerLine, sepLine];
  for (const row of dataRows) {
    // +1 for newline when joined; be conservative
    const prospective = [...current, row, fenceEnd].join('\n');
    if (prospective.length > maxLen) {
      // close current chunk
      current.push(fenceEnd);
      chunks.push(current.join('\n'));
      // start new chunk with header again
      current = [headerFenceStart, headerLine, sepLine, row];
    } else {
      current.push(row);
    }
  }
  // flush last
  if (current.length) {
    current.push(fenceEnd);
    chunks.push(current.join('\n'));
  }
  return chunks;
}

module.exports = {
  loadServersConfig,
  fetchServerStatuses,
  buildDiscordMessage,
  buildDiscordMessages,
  formatSeconds,
};
