import { ServerConfig, ServerStatus, ServersConfig } from '../types';

export class ServerDataService {
  private static slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private static resolveStatsUrl(server: ServerConfig): string | undefined {
    if (server.statsUrl) return server.statsUrl;
    if (!server.name) return undefined;
    const slug = this.slugify(server.name);
    if (!slug) return undefined;
    return `https://server-stats.anzr.org/servers/${slug}`;
  }

  static async fetchServersConfig(): Promise<ServersConfig> {
    try {
      const configUrl = `${process.env.PUBLIC_URL || ''}/servers.json`;
      const response = await fetch(configUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch servers config: ${response.statusText}`);
      }
      const data = await response.json();
      const validated = this.validateServersConfig(data);
      return validated;
    } catch (error) {
      console.error('Error fetching servers config:', error);
      throw error;
    }
  }

  static async fetchServerStatus(server: ServerConfig): Promise<ServerStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = this.toProxiedUrl(server);
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      let raw: any;
      try {
        raw = await res.json();
      } catch (e) {
        throw new Error('Invalid JSON response');
      }

      const payload = this.unwrapApiResponse(raw);
      const mapped = this.mapApiResponseToStatus(payload, server);
      return {
        ...mapped,
        status: 'success',
        lastUpdated: new Date(),
        statsUrl: this.resolveStatsUrl(server),
      };
    } catch (error) {
      return {
        id: server.id,
        name: server.name,
        status: 'error',
        alliesPlayers: 0,
        axisPlayers: 0,
        playerCount: 0,
        maxPlayerCount: undefined,
        gameTime: '--:--',
        alliesScore: 0,
        axisScore: 0,
        currentMap: 'Unknown',
        nextMap: 'Unknown',
        lastUpdated: new Date(),
        statsUrl: this.resolveStatsUrl(server),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private static generateMockServerData(
    server: ServerConfig
  ): Omit<ServerStatus, 'status' | 'lastUpdated'> {
    const maps = [
      'Carentan',
      'Sainte-M\u00E8re-\u00C9glise',
      'Foy',
      'Purple Heart Lane',
      'Hill 400',
    ];
    return {
      id: server.id,
      name: server.name,
      alliesPlayers: Math.floor(Math.random() * 32),
      axisPlayers: Math.floor(Math.random() * 32),
      playerCount: Math.floor(Math.random() * 64),
      maxPlayerCount: 64,
      gameTime: `${Math.floor(Math.random() * 60)
        .toString()
        .padStart(2, '0')}:${Math.floor(Math.random() * 60)
        .toString()
        .padStart(2, '0')}`,
      alliesScore: Math.floor(Math.random() * 6),
      axisScore: Math.floor(Math.random() * 6),
      currentMap: maps[Math.floor(Math.random() * maps.length)],
      nextMap: maps[Math.floor(Math.random() * maps.length)],
    };
  }

  private static unwrapApiResponse(data: any): any {
    if (!data || typeof data !== 'object') return data;
    if (data.result && typeof data.result === 'object') return data.result;
    return data;
  }

  private static mapApiResponseToStatus(
    source: any,
    server: ServerConfig
  ): Omit<ServerStatus, 'status' | 'lastUpdated'> {
    const data = source ?? {};

    const num = (v: any, d?: number) =>
      typeof v === 'number' && isFinite(v) ? v : d;
    const optionalStr = (v: any) =>
      typeof v === 'string' && v.trim() !== '' ? v : undefined;

    // Try multiple common key variants
    const alliesPlayers = num(
      data?.alliesPlayers ??
        data?.allies ??
        data?.allies_count ??
        data?.numAllies ??
        data?.num_allies ??
        data?.players?.allies ??
        data?.player_count_by_team?.allied ??
        data?.playerCountAllies ??
        (Array.isArray(data?.players)
          ? data.players.filter((p: any) => p?.team === 'allies').length
          : undefined)
    , 0) ?? 0;
    const axisPlayers = num(
      data?.axisPlayers ??
        data?.axis ??
        data?.axis_count ??
        data?.numAxis ??
        data?.num_axis ??
        data?.players?.axis ??
        data?.player_count_by_team?.axis ??
        data?.playerCountAxis ??
        (Array.isArray(data?.players)
          ? data.players.filter((p: any) => p?.team === 'axis').length
          : undefined)
    , 0) ?? 0;

    const playerCount = num(
      data?.player_count ??
        data?.players ??
        data?.population ??
        data?.playerCount
    , alliesPlayers + axisPlayers) ?? (alliesPlayers + axisPlayers);

    const maxPlayerCount = num(
      data?.max_player_count ??
        data?.maxPlayers ??
        data?.max_player ??
        data?.max_playercount ??
        data?.max_player_count ??
        data?.max_player_capacity ??
        data?.maxPlayerCount ??
        data?.slots
    , undefined);

    const gameTimeRaw = data?.gameTime ?? data?.match_time ?? data?.time ?? data?.game_time ?? data?.timeRemainingDisplay;
    const gameTime = typeof gameTimeRaw === 'string'
      ? gameTimeRaw
      : typeof gameTimeRaw === 'number'
        ? String(gameTimeRaw)
        : '--:--';

    const timeRemainingSeconds = num(
      data?.time_remaining ?? data?.remaining_time ?? data?.timeRemaining
    , undefined);

    const alliesScore = num(
      data?.alliesScore ??
        data?.score?.allied ??
        data?.score?.allies ??
        data?.allies_score ??
        data?.scores?.allies ??
        data?.allies ??
        data?.teamScores?.allies
    , 0) ?? 0;
    const axisScore = num(
      data?.axisScore ??
        data?.score?.axis ??
        data?.axis_score ??
        data?.scores?.axis ??
        data?.axis ??
        data?.teamScores?.axis
    , 0) ?? 0;

    const currentMap =
      optionalStr(data?.currentMap) ??
      optionalStr(data?.map) ??
      optionalStr(data?.current_map?.map?.pretty_name) ??
      optionalStr(data?.current_map?.map?.name) ??
      optionalStr(data?.current_map?.pretty_name) ??
      optionalStr(data?.current_map?.name) ??
      optionalStr(data?.current_map?.map?.id) ??
      optionalStr(data?.current_map) ??
      'Unknown';
    const nextMap =
      optionalStr(data?.nextMap) ??
      optionalStr(data?.next_map?.map?.pretty_name) ??
      optionalStr(data?.next_map?.map?.name) ??
      optionalStr(data?.next_map?.pretty_name) ??
      optionalStr(data?.next_map?.name) ??
      optionalStr(data?.next_map?.map?.id) ??
      optionalStr(data?.next_map) ??
      optionalStr(data?.nextMapName) ??
      'Unknown';

    const shortName =
      optionalStr(
        data?.short_name ??
          data?.shortName ??
          data?.name_short
      ) ??
      optionalStr(
        data?.name?.short_name ??
          data?.name?.shortName
      );

    return {
      id: server.id,
      name: server.name,
      shortName: shortName || undefined,
      alliesPlayers,
      axisPlayers,
      playerCount,
      maxPlayerCount: typeof maxPlayerCount === 'number' && isFinite(maxPlayerCount) ? maxPlayerCount : undefined,
      gameTime,
      timeRemainingSeconds: typeof timeRemainingSeconds === 'number' ? timeRemainingSeconds : undefined,
      alliesScore,
      axisScore,
      currentMap,
      nextMap,
    };
  }

  // If the apiUrl is http:// and the app is served over https, route via a proxy
  private static toProxiedUrl(server: ServerConfig): string {
    try {
      const hasWindow = typeof window !== 'undefined';
      const base = hasWindow ? window.location.origin : undefined;
      const u = base ? new URL(server.apiUrl, base) : new URL(server.apiUrl);
      const proxyBaseEnv = process.env.REACT_APP_PROXY_URL;
      const target = encodeURIComponent(u.toString());
      const hostParam = server.hostHeader ? `&host=${encodeURIComponent(server.hostHeader)}` : '';
      if (proxyBaseEnv) {
        return `${proxyBaseEnv.replace(/\/$/, '')}?target=${target}${hostParam}`;
      }
      if (hasWindow && process.env.NODE_ENV === 'production') {
        const rawBase = process.env.PUBLIC_URL || '';
        const basePath = rawBase === '.' ? '' : rawBase.replace(/\/$/, '');
        return `${window.location.origin}${basePath}/api?target=${target}${hostParam}`;
      }
      return u.toString();
    } catch {
      return server.apiUrl; // fall back to raw
    }
  }
}

// Lightweight runtime validation of servers.json
export namespace ServerDataService {
  export function validateServersConfig(input: any): ServersConfig {
    const errors: string[] = [];

    // Accept legacy/simple array format: [{ name, url }]
    if (Array.isArray(input)) {
      const result: ServerConfig[] = [];
      const seenIds = new Set<string>();
      input.forEach((s: any, idx: number) => {
        const path = `servers[${idx}]`;
        if (!s || typeof s !== 'object') {
          errors.push(`${path} must be an object`);
          return;
        }
        const name = typeof s.name === 'string' ? s.name.trim() : '';
        const url = typeof s.url === 'string' ? s.url.trim() : '';
        const hostHeader = typeof s.host === 'string' ? s.host.trim() : (typeof s.hostHeader === 'string' ? s.hostHeader.trim() : '');
        if (!name) errors.push(`${path}.name must be a non-empty string`);
        if (!url) errors.push(`${path}.url must be a non-empty string`);
        const baseId = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `server-${idx+1}`;
        let id = baseId;
        let salt = 1;
        while (seenIds.has(id)) {
          salt += 1;
          id = `${baseId}-${salt}`;
        }
        seenIds.add(id);
        if (name && url) {
          const out: any = { id, name, apiUrl: url };
          if (hostHeader) out.hostHeader = hostHeader;
          if (typeof (s as any).statsUrl === 'string') out.statsUrl = (s as any).statsUrl.trim();
          if (typeof (s as any).stats === 'string' && !out.statsUrl) out.statsUrl = (s as any).stats.trim();
          result.push(out);
        }
      });
      if (errors.length > 0) {
        throw new Error(`Invalid servers.json (array format):\n- ${errors.join('\n- ')}`);
      }
      return { servers: result };
    }

    // Object format: { servers: [{ id, name, apiUrl }] }
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid servers.json: root must be an object or an array.');
    }

    const servers = (input as any).servers;
    if (!Array.isArray(servers)) {
      throw new Error('Invalid servers.json: "servers" must be an array.');
    }

    const seenIds = new Set<string>();
    const result: ServerConfig[] = [];
    servers.forEach((s: any, idx: number) => {
      const path = `servers[${idx}]`;
      if (!s || typeof s !== 'object') {
        errors.push(`${path} must be an object`);
        return;
      }
      const { id, name, apiUrl } = s as Partial<ServerConfig>;
      if (typeof id !== 'string' || id.trim() === '') errors.push(`${path}.id must be a non-empty string`);
      if (typeof name !== 'string' || name.trim() === '') errors.push(`${path}.name must be a non-empty string`);
      if (typeof apiUrl !== 'string' || apiUrl.trim() === '') errors.push(`${path}.apiUrl must be a non-empty string`);
      if (typeof id === 'string') {
        if (seenIds.has(id)) errors.push(`${path}.id duplicates an existing id: "${id}"`);
        else seenIds.add(id);
      }
      if (typeof id === 'string' && typeof name === 'string' && typeof apiUrl === 'string') {
        const out: any = { id, name, apiUrl };
        if (typeof (s as any).hostHeader === 'string') out.hostHeader = (s as any).hostHeader;
        if (typeof (s as any).host === 'string') out.hostHeader = (s as any).host;
        if (typeof (s as any).statsUrl === 'string') out.statsUrl = (s as any).statsUrl;
        if (typeof (s as any).stats === 'string' && !out.statsUrl) out.statsUrl = (s as any).stats;
        result.push(out);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Invalid servers.json:\n- ${errors.join('\n- ')}`);
    }

    return { servers: result };
  }
}
