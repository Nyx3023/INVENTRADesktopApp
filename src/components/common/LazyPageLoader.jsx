const LazyPageLoader = ({
  title = 'Loading',
  subtitle = 'Please wait while data is prepared...',
  rows = 4,
  centered = true,
  compact = false,
  className = '',
}) => {
  const containerClass = centered
    ? 'min-h-[55vh] flex items-center justify-center'
    : 'w-full';

  const panelClass = compact
    ? 'w-full max-w-2xl rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-4 bg-white/80 dark:bg-slate-900/60 backdrop-blur'
    : 'w-full max-w-3xl rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-5 md:p-6 bg-white/80 dark:bg-slate-900/60 backdrop-blur';

  return (
    <div className={`${containerClass} ${className}`}>
      <div className={panelClass}>
        <div className="mb-5">
          <div className="h-6 w-52 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-72 max-w-full rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse mt-3" />
          {(title || subtitle) && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {Array.from({ length: Math.max(1, rows) }).map((_, idx) => (
            <div
              key={`loader-row-${idx}`}
              className="rounded-lg border border-slate-100 dark:border-slate-800 p-3"
            >
              <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="mt-3 grid grid-cols-12 gap-2">
                <div className="col-span-7 h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="col-span-3 h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="col-span-2 h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LazyPageLoader;
