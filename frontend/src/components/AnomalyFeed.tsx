// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import { AnimatePresence, motion } from "framer-motion";
import type { Anomaly, AnomalyKind } from "@/lib/types";

const KIND_LABEL: Record<AnomalyKind, string> = {
  iv_spike: "IV spike",
  pc_ratio_shift: "Put/Call shift",
  vol_oi_divergence: "Vol/OI divergence",
};

export function AnomalyFeed({
  anomalies,
  selectedId,
  onSelect,
}: {
  anomalies: Anomaly[];
  selectedId?: string;
  onSelect: (a: Anomaly) => void;
}) {
  return (
    <aside className="flex min-h-[600px] flex-col rounded-lg border border-hair bg-panel/50 shadow-inset">
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h2 className="rule-caret font-display text-xl leading-none">Anomaly Feed</h2>
        <span className="font-mono tnum text-[10px] uppercase tracking-[0.14em] text-faint">
          {anomalies.length} in session
        </span>
      </div>

      {anomalies.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <div className="max-w-[240px] text-sm text-muted">
            <div className="mb-2 font-display text-lg italic text-ink">Quiet tape.</div>
            No signals yet. Start a historical replay above, or wait for the
            detector's rolling window to warm up.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          <AnimatePresence initial={false}>
            {anomalies.map((a) => (
              <motion.button
                key={a.id}
                layout
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                onClick={() => onSelect(a)}
                className={`group mb-1.5 block w-full rounded-md border p-3 text-left transition-colors ${
                  selectedId === a.id
                    ? "border-copper/50 bg-copper/8"
                    : "border-hair bg-elev/30 hover:border-copper/25 hover:bg-elev/60"
                }`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-copper">
                    {KIND_LABEL[a.kind]}
                  </span>
                  <ConfidenceMini confidence={a.confidence} />
                </div>
                <div className="font-mono text-[12px] leading-snug text-ink">
                  {a.headline}
                </div>
                <FactorRow factors={a.factors} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </aside>
  );
}

function ConfidenceMini({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 80 ? "text-amber" : confidence >= 60 ? "text-copper" : "text-muted";
  return (
    <span className={`font-mono tnum text-[11px] font-medium ${tone}`}>
      {confidence.toFixed(0)}
      <span className="text-[9px] text-faint"> / 100</span>
    </span>
  );
}

function FactorRow({
  factors,
}: {
  factors: { magnitude: number; sample: number; regime: number };
}) {
  const cells: [string, number][] = [
    ["mag", factors.magnitude],
    ["smp", factors.sample],
    ["rgm", factors.regime],
  ];
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {cells.map(([label, val]) => (
        <div key={label} className="flex-1">
          <div className="mb-0.5 flex items-baseline justify-between text-[9px] uppercase tracking-wider text-faint">
            <span>{label}</span>
            <span className="tnum text-muted">{val.toFixed(0)}</span>
          </div>
          <div className="h-[3px] rounded-full bg-elev">
            <div
              className="h-[3px] rounded-full bg-copper/70"
              style={{ width: `${Math.max(4, val)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
