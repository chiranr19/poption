import type { ChainSnapshot, Regime } from "@/lib/types";
import { GuaranteesRibbon } from "@/components/learn/GuaranteesRibbon";

const REGIME_LABEL: Record<Regime, { label: string; tone: string }> = {
  calm: { label: "Calm", tone: "text-sage border-sage/40 bg-sage/10" },
  normal: { label: "Normal", tone: "text-ink border-hair bg-elev" },
  stressed: { label: "Stressed", tone: "text-amber border-amber/40 bg-amber/10" },
};

const STATUS_LABEL: Record<"connecting" | "open" | "closed", { text: string; dot: string }> = {
  connecting: { text: "Connecting…", dot: "bg-amber" },
  open: { text: "Live", dot: "bg-sage" },
  closed: { text: "Reconnecting…", dot: "bg-rose" },
};

export function TopBar({
  snapshot,
  status,
  openWatching = 0,
}: {
  snapshot: ChainSnapshot | null;
  status: "connecting" | "open" | "closed";
  openWatching?: number;
}) {
  const regime = snapshot ? REGIME_LABEL[snapshot.regime] : REGIME_LABEL.normal;
  const s = STATUS_LABEL[status];

  return (
    <header className="sticky top-0 z-40 border-b border-hair bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-end justify-between gap-6 px-4 pb-4 pt-6 lg:px-6">
        {/* Wordmark + tagline */}
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-4xl leading-none tracking-tight">
              Poption
            </h1>
            <span className="hidden text-[10px] uppercase tracking-[0.24em] text-faint sm:inline">
              options-flow forensics
            </span>
          </div>
          <p className="mt-1 font-display text-sm italic text-muted">
            Options-flow forensics · learn the market by watching it
          </p>
          <div className="mt-2 flex items-center gap-4">
            <GuaranteesRibbon />
            {openWatching > 0 && (
              <span className="text-[10px] uppercase tracking-[0.18em] text-copper">
                <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-copper" />
                Watching {openWatching} trade{openWatching === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {/* Live readout */}
        <div className="flex items-center gap-6">
          <RegimeChip label={regime.label} tone={regime.tone} />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-faint">
              {snapshot?.symbol ?? "—"}
            </div>
            <div className="tnum font-mono text-2xl font-medium text-ink">
              {snapshot ? `$${snapshot.spot.toFixed(2)}` : "—"}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-hair px-3 py-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot} shadow-[0_0_6px] shadow-current`} />
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{s.text}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function RegimeChip({ label, tone }: { label: string; tone: string }) {
  return (
    <div className={`rounded-full border px-3 py-1.5 ${tone}`}>
      <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">regime</span>
      <span className="ml-2 font-mono text-[13px] font-medium">{label}</span>
    </div>
  );
}
