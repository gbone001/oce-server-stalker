import { useState, useEffect, useCallback } from 'react';
import { ServerConfig, ServerStatus } from '../types';
import { ServerDataService } from '../services/ServerDataService';
import { defaultConfig } from '../config';

export const useServerData = () => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Map<string, ServerStatus>>(new Map());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServerStatuses = useCallback(async (serverList?: ServerConfig[]) => {
    if (!Array.isArray(serverList) || serverList.length === 0) return;

    try {
      const statusPromises = serverList.map(server => 
        ServerDataService.fetchServerStatus(server)
      );
      
      const statuses = await Promise.allSettled(statusPromises);
      const statusMap = new Map<string, ServerStatus>();
      
      statuses.forEach((result, index) => {
        const server = serverList[index];
        if (result.status === 'fulfilled') {
          statusMap.set(server.id, result.value);
        } else {
          statusMap.set(server.id, {
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
            statsUrl: server.statsUrl,
            error: 'Failed to fetch data'
          });
        }
      });
      
      setServerStatuses(statusMap);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (Array.isArray(servers) && servers.length > 0) {
      await fetchServerStatuses(servers);
    }
  }, [servers, fetchServerStatuses]);

  const loadConfigAndStatuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await ServerDataService.fetchServersConfig();
      const list = Array.isArray((config as any)?.servers) ? (config as any).servers as ServerConfig[] : [];
      setServers(list);
      await fetchServerStatuses(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [fetchServerStatuses]);

  useEffect(() => {
    loadConfigAndStatuses();
  }, [loadConfigAndStatuses]);

  useEffect(() => {
    if (!Array.isArray(servers) || servers.length === 0) return;

    const interval = setInterval(() => {
      refreshData();
    }, defaultConfig.pollInterval);

    return () => clearInterval(interval);
  }, [servers, refreshData]);

  return {
    servers,
    serverStatuses,
    lastRefresh,
    loading,
    error,
    refreshData,
    reloadConfig: loadConfigAndStatuses
  };
};
