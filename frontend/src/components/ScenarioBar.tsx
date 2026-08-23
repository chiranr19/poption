// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import type { Scenario } from "@/lib/types";

export function ScenarioBar({
  scenarios,
  active,
  activeTitle,
  onStart,
  onStop,
}: {
  scenarios: Scenario[];
  active: string | null;
  activeTitle: string | null;
  onStart: (key: string) => void;
  onStop: () => void;
}) {
  return (
    <div className="border-b border-hair bg-panel/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <span className="rule-caret text-[10px] uppercase tracking-[0.22em] text-muted">
          Historical replay
        </span>
        <div className="ml-2 flex flex-wrap gap-2">
          {scenarios.map((s) => {
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => onStart(s.key)}
                className={`group rounded-md border px-3 py-1.5 text-left transition-colors ${
                  isActive
                    ? "border-copper/50 bg-copper/10 text-ink"
                    : "border-hair bg-elev/60 text-muted hover:border-copper/40 hover:text-ink"
                }`}
                title={s.summary}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium tracking-wide">{s.title}</span>
                  <span className="tnum font-mono text-[10px] text-faint group-hover:text-muted">
                    {s.date}
                  </span>
                </div>
              </button>
            );
          })}
          {active && (
            <button
              onClick={onStop}
              className="rounded-md border border-rose/40 bg-rose/10 px-3 py-1.5 text-[11px] font-medium tracking-wide text-rose hover:bg-rose/15"
            >
              Stop replay
            </button>
          )}
        </div>
        {active && activeTitle && (
          <span className="ml-auto text-[11px] text-muted">
            Replaying <span className="font-mono text-ink">{activeTitle}</span> —
            watch the anomaly feed
          </span>
        )}
      </div>
    </div>
  );
}
