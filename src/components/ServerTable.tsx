import React from 'react';
import { ServerStatus } from '../types';
import { StatusIndicator } from './StatusIndicator';

interface ServerTableProps {
  serverStatuses: Map<string, ServerStatus>;
}

export const ServerTable: React.FC<ServerTableProps> = ({ serverStatuses }) => {
  const statuses = Array.from(serverStatuses.values());

  const ScoreDisplay: React.FC<{ allies: number; axis: number }> = ({ allies, axis }) => (
    <div className="flex items-center justify-center gap-4 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-accent-200">
      <span className="flex items-center gap-2">
        <span className="text-lg font-bold text-white">{allies}</span>
        <span className="text-[10px] text-white/70">Allies</span>
      </span>
      <span className="h-4 w-px bg-white/15" aria-hidden="true" />
      <span className="flex items-center gap-2">
        <span className="text-lg font-bold text-primary-200">{axis}</span>
        <span className="text-[10px] text-white/70">Axis</span>
      </span>
    </div>
  );

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
            <col style={{ width: '12%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead className="bg-primary-900/80">
            <tr>
              {['Status','Server','Short Name','Players','Score','Time Remaining','Next Map'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.32em] text-accent-200"
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
                <td className="px-4 py-5 align-middle">
                  <StatusIndicator status={server.status} error={server.error} />
                </td>
                <td className="px-4 py-5 align-middle">
                  <div className="flex flex-col">
                    <span className="text-base font-semibold uppercase tracking-[0.08em] text-white">
                      {server.name}
                    </span>
                    {server.currentMap && (
                    <span className="mt-2 text-xs uppercase tracking-[0.24em] text-accent-200">
                        Current Map:{' '}
                        <span className="text-white/90">{server.currentMap || '—'}</span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-5 align-middle">
                  <span className="text-sm uppercase tracking-[0.26em] text-accent-200">
                    {server.shortName ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-5 align-middle">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-accent-100">
                    <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-white">
                      A {server.alliesPlayers}
                    </span>
                    <span className="rounded-full border border-primary-500/30 bg-primary-900/50 px-3 py-1 text-primary-100">
                      X {server.axisPlayers}
                    </span>
                    <span className="text-[10px] text-white/60">
                      Σ {server.alliesPlayers + server.axisPlayers}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <ScoreDisplay allies={server.alliesScore} axis={server.axisScore} />
                </td>
                <td className="px-4 py-5 align-middle text-center">
                  <span className="rounded-full border border-white/15 bg-black/40 px-4 py-2 font-mono text-sm tracking-[0.3em] text-white/90">
                    {formatRemaining(server.timeRemainingSeconds)}
                  </span>
                </td>
                <td className="px-4 py-5 align-middle">
                  <span className="rounded-full border border-accent-500/30 bg-accent-900/40 px-4 py-2 text-xs uppercase tracking-[0.26em] text-accent-100">
                    {server.nextMap || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
