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

async function loadServersConfig() {
  const rawPath = path.join(__dirname, '..', 'public', 'servers.json');
  let rawText;
  try {
    rawText = await fs.readFile(rawPath, 'utf8');
  } catch (err) {
    throw new Error(`Unable to read public/servers.json: ${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`public/servers.json contains invalid JSON: ${err.message}`);
  }

  if (Array.isArray(data)) {
    return data.map((entry, index) => normalizeArrayEntry(entry, index));
  }

  if (!data || typeof data !== 'object') {
    throw new Error('public/servers.json must contain an array or an object with a "servers" array.');
  }

  if (!Array.isArray(data.servers)) {
    throw new Error('public/servers.json: object format requires a "servers" array');
  }

  return data.servers.map((entry, index) => normalizeObjectEntry(entry, index));
}

function normalizeArrayEntry(entry, index) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`public/servers.json[${index}] must be an object`);
  }
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const url = typeof entry.url === 'string' ? entry.url.trim() : '';
  const hostHeader =
    typeof entry.host === 'string'
      ? entry.host.trim()
      : typeof entry.hostHeader === 'string'
        ? entry.hostHeader.trim()
        : undefined;
  if (!name || !url) {
    throw new Error(`public/servers.json[${index}] requires non-empty "name" and "url" fields`);
  }
  return {
    id: slugify(name) || `server-${index + 1}`,
    name,
    apiUrl: url,
    hostHeader,
  };
}

function normalizeObjectEntry(entry, index) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`public/servers.json.servers[${index}] must be an object`);
  }
  const { id, name, apiUrl, hostHeader, host } = entry;
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error(`public/servers.json.servers[${index}].id must be a non-empty string`);
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(`public/servers.json.servers[${index}].name must be a non-empty string`);
  }
  if (typeof apiUrl !== 'string' || !apiUrl.trim()) {
    throw new Error(`public/servers.json.servers[${index}].apiUrl must be a non-empty string`);
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
      statsUrl: server.apiUrl, // <— add this
    };
  } catch (err) {
    return {
      id: server.id,
      name: server.name,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
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
