import React from 'react';

interface StatusIndicatorProps {
  status: 'success' | 'error';
  error?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error }) => {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
          status === 'success'
            ? 'border-accent-300 bg-primary-500/70 animate-pulse'
            : 'border-red-500/70 bg-red-600/80'
        }`}
      >
        <span className="h-2 w-2 rounded-full bg-white/90" aria-hidden="true" />
      </span>
      <span
        className={`text-xs uppercase tracking-[0.26em] ${
          status === 'success' ? 'text-accent-100' : 'text-red-300'
        }`}
      >
        {status === 'success' ? 'Online' : 'Offline'}
      </span>
      {error && (
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/50" title={error}>
          {error}
        </span>
      )}
    </div>
  );
};
