import React from 'react';
import { ServerStatus } from '../types';
import { StatusIndicator } from './StatusIndicator';

interface ServerTableProps {
  serverStatuses: Map<string, ServerStatus>;
}

export const ServerTable: React.FC<ServerTableProps> = ({ serverStatuses }) => {
  const statuses = Array.from(serverStatuses.values());

  const scoreDisplay = (allies: number, axis: number) =>
    `${allies} Allies   ${axis} Axis`;

  const playerDisplay = (server: ServerStatus) => {
    const total = typeof server.playerCount === 'number'
      ? server.playerCount
      : server.alliesPlayers + server.axisPlayers;
    const max = typeof server.maxPlayerCount === 'number' && isFinite(server.maxPlayerCount)
      ? server.maxPlayerCount
      : undefined;
    if (typeof max === 'number' && max > 0) {
      return `${total}/${max}`;
    }
    return `${total}`;
  };

  if (statuses.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/50 p-12 text-center text-sm uppercase tracking-[0.3em] text-accent-200">
        No servers configured
      </div>
    );
  }

  const formatRemaining = (secs?: number) => {
    if (typeof secs !== 'number' || !isFinite(secs) || secs < 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed border-collapse text-sm text-white md:text-base">
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead className="bg-primary-900/80">
            <tr>
              {['Status','Server','Players','Score','Time Remaining','Current Map','Next Map','Stats'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-accent-200"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statuses.map((server, index) => (
              <tr
                key={server.id}
                className={`border-t border-white/5 ${index % 2 === 0 ? 'bg-white/10' : 'bg-black/40'}`}
              >
                <td className="px-4 py-5 align-middle text-center">
                  <div className="flex justify-center">
                    <StatusIndicator status={server.status} error={server.error} />
                  </div>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-base font-semibold uppercase tracking-[0.08em] text-white">
                      {server.name}
                    </span>
                    {server.shortName && (
                      <span className="mt-1 text-xs uppercase tracking-[0.24em] text-accent-200">
                        {server.shortName}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <span className="inline-flex min-w-[88px] justify-center rounded-full border border-white/15 bg-black/40 px-4 py-2 font-mono text-sm tracking-[0.28em] text-white">
                    {playerDisplay(server)}
                  </span>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <span className="inline-flex min-w-[180px] justify-center rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-accent-200">
                    {scoreDisplay(server.alliesScore, server.axisScore)}
                  </span>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <span className="rounded-full border border-white/15 bg-black/40 px-4 py-2 font-mono text-sm tracking-[0.3em] text-white/90">
                    {formatRemaining(server.timeRemainingSeconds)}
                  </span>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <span className="rounded-full border border-accent-500/30 bg-accent-900/40 px-4 py-2 text-xs uppercase tracking-[0.26em] text-accent-100">
                    {server.currentMap || '—'}
                  </span>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <span className="rounded-full border border-accent-500/30 bg-accent-900/40 px-4 py-2 text-xs uppercase tracking-[0.26em] text-accent-100">
                    {server.nextMap || '—'}
                  </span>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  {server.statsUrl ? (
                    <a
                      href={server.statsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-primary-500/40 bg-primary-600/30 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-primary-100 transition hover:bg-primary-500/50 hover:text-white"
                    >
                      Stats
                    </a>
                  ) : (
                    <span className="text-[10px] uppercase tracking-[0.24em] text-white/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
