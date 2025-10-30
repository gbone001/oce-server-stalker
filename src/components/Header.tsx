import React from 'react';

interface HeaderProps {
  onToggleTheme: () => void;
  isDark: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleTheme, isDark }) => {
  const pngLogo = `${process.env.PUBLIC_URL}/anzr-logo.png`;
  return (
    <header className="relative border-b border-white/10 bg-black/70 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <img
            src={pngLogo}
            alt="ANZR crest"
            width={84}
            height={84}
            decoding="async"
            loading="eager"
            fetchPriority="high"
            className="h-20 w-20 rounded-2xl border border-accent-500/40 shadow-lg shadow-black/40 object-cover"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-accent-300">
              From the Ashes We Rise
            </p>
            <h1 className="mt-2 text-3xl font-semibold uppercase tracking-[0.08em] text-white">
              ANZR Server Command
            </h1>
            <p className="mt-2 text-sm text-accent-100/80">
              Real-time status intelligence for Australian &amp; New Zealand Regiment deployments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-100 transition hover:border-accent-500/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-black"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                Light Mode
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                Night Ops
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
