export interface ServerConfig {
  id: string;
  name: string;
  apiUrl: string;
  hostHeader?: string; // optional override for Host header at proxy
  statsUrl?: string;
}

export interface ServerStatus {
  id: string;
  name: string;
  shortName?: string;
  status: 'success' | 'error';
  alliesPlayers: number;
  axisPlayers: number;
  playerCount: number;
  maxPlayerCount?: number;
  gameTime: string;
  timeRemainingSeconds?: number;
  alliesScore: number; // 0-5 points
  axisScore: number; // 0-5 points
  currentMap: string;
  nextMap: string;
  lastUpdated: Date;
  statsUrl?: string;
  error?: string;
}

export interface ServersConfig {
  servers: ServerConfig[];
}

export interface Theme {
  isDark: boolean;
}

export interface AppConfig {
  pollInterval: number; // milliseconds
  theme: Theme;
}
