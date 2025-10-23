import React from 'react';
import { Header, ServerTable, LastRefreshTimer } from './components';
import { useTheme } from './hooks/useTheme';
import { useServerData } from './hooks/useServerData';

function App() {
  const { isDark, toggleTheme } = useTheme();
  const { serverStatuses, lastRefresh, loading, error, refreshData, reloadConfig } = useServerData();

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center text-white">
        <div className="absolute inset-0 bg-black/60" aria-hidden />
        <div className="relative z-10 text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-accent-500/40 border-t-primary-500"></div>
          <p className="mt-6 text-sm uppercase tracking-[0.25em] text-accent-200">
            Preparing battlefield intel...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen text-white">
        <div className="absolute inset-0 bg-black/70" aria-hidden />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header onToggleTheme={toggleTheme} isDark={isDark} />
          <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-6">
            <div className="w-full rounded-3xl border border-primary-500/40 bg-black/60 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur">
              <div className="flex items-start">
                <svg className="mr-4 h-10 w-10 flex-shrink-0 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5C2.962 17.333 3.924 19 5.464 19z" />
                </svg>
                <div>
                  <h3 className="text-2xl font-semibold tracking-[0.12em] text-accent-200">Signal Lost</h3>
                  <p className="mt-3 text-sm leading-relaxed text-accent-100/80">
                    We couldn&apos;t retrieve the latest server reports. Please verify the server configuration and try again.
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-primary-200/80">
                    {error}
                  </p>
                  <button
                    onClick={reloadConfig}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-primary-500/50 bg-primary-600 px-6 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-black"
                  >
                    Retry Linking
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white">
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header onToggleTheme={toggleTheme} isDark={isDark} />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-10">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-accent-300">ANZR Operational Command</p>
                  <h2 className="mt-3 text-3xl font-semibold uppercase tracking-tight text-white sm:text-4xl">
                    Server Stalker Dashboard
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm text-accent-100/80">
                    Live intelligence on our Hell Let Loose servers, updated minute-by-minute. Monitor
                    faction balance, map rotation, and remaining operation time from a single command console.
                  </p>
                </div>
                <div className="flex items-center justify-start gap-3 md:justify-end">
                  <div className="rounded-full border border-accent-500/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-accent-100/90">
                    Status Link Established
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <LastRefreshTimer lastRefresh={lastRefresh} refreshData={refreshData} />
                <ServerTable serverStatuses={serverStatuses} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
