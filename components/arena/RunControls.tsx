"use client";

type RunControlsProps = {
  startDate: string;
  endDate: string;
  intervalMinutes: number;
  enriched: boolean;
  useTools: boolean;
  running: boolean;
  onChange: (updates: Partial<{
    startDate: string;
    endDate: string;
    intervalMinutes: number;
    enriched: boolean;
    useTools: boolean;
  }>) => void;
  onStart: () => void;
  onStop: () => void;
};

const INTERVAL_OPTIONS = [
  { label: "Daily 09:30", value: 1440 },
  { label: "Every 60m", value: 60 },
  { label: "Every 30m", value: 30 },
];

export function RunControls({
  startDate,
  endDate,
  intervalMinutes,
  enriched,
  useTools,
  running,
  onChange,
  onStart,
  onStop,
}: RunControlsProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onStart();
      }}
      className="flex flex-wrap items-center gap-3 text-xs text-zinc-300"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Start
        </span>
        <input
          type="date"
          className="rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
          value={startDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          End
        </span>
        <input
          type="date"
          className="rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
          value={endDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Interval
        </span>
        <select
          value={intervalMinutes}
          onChange={(event) =>
            onChange({ intervalMinutes: Number(event.target.value) })
          }
          className="rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
        >
          {INTERVAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enriched}
          onChange={(event) => onChange({ enriched: event.target.checked })}
          className="h-4 w-4 rounded border border-white/10 bg-black/40"
        />
        <span className="text-[11px] uppercase tracking-wide text-zinc-400">
          Enriched
        </span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={useTools}
          onChange={(event) => onChange({ useTools: event.target.checked })}
          className="h-4 w-4 rounded border border-white/10 bg-black/40"
        />
        <span className="text-[11px] uppercase tracking-wide text-zinc-400">
          Tools
        </span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={running}
          className="rounded bg-emerald-500 px-3 py-1 font-semibold text-black transition disabled:cursor-not-allowed disabled:bg-emerald-500/40"
        >
          Start
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!running}
          className="rounded border border-white/20 px-3 py-1 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-zinc-600"
        >
          Stop
        </button>
      </div>
    </form>
  );
}
