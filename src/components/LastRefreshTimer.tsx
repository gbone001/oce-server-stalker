import React from 'react';

interface LastRefreshTimerProps {
  lastRefresh: Date | null;
  refreshData: () => void;
}

export const LastRefreshTimer: React.FC<LastRefreshTimerProps> = ({ lastRefresh, refreshData }) => {
  const [timeAgo, setTimeAgo] = React.useState<string>('');

  React.useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastRefresh) {
        setTimeAgo('Awaiting first contact');
        return;
      }

      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - lastRefresh.getTime()) / 1000);
      
      if (diffInSeconds < 60) {
        setTimeAgo(`${diffInSeconds}s ago`);
      } else {
        const minutes = Math.floor(diffInSeconds / 60);
        setTimeAgo(`${minutes}m ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [lastRefresh]);

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner shadow-black/30 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center text-xs uppercase tracking-[0.2em] text-accent-200">
        <svg className="mr-3 h-5 w-5 text-primary-300" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Last Update:&nbsp;
        <span className="font-semibold tracking-[0.28em] text-accent-100">{timeAgo}</span>
      </div>

      <button
        onClick={refreshData}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-500/40 bg-primary-600 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 focus:ring-offset-black"
      >
        <svg className="h-4 w-4" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh Feed
      </button>
    </div>
  );
};
