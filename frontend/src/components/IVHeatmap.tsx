import { useMemo } from "react";
import type { ChainSnapshot } from "@/lib/types";

/**
 * IV surface as a grid: rows = tenors, columns = strike offsets. Copper-heat
 * palette so hot cells read "elevated vol" without borrowing the tired
 * red/green trader convention (which is for direction, not level).
 */
export function IVHeatmap({ snapshot }: { snapshot: ChainSnapshot | null }) {
  const { rows, ivRange } = useMemo(() => {
    if (!snapshot) return { rows: [], ivRange: [0, 1] as [number, number] };
    // Group IVs by (dte, strike) — use calls only so we're comparing apples.
    const calls = snapshot.quotes.filter((q) => q.type === "call");
    const dtes = Array.from(new Set(calls.map((q) => q.dte_days))).sort((a, b) => a - b);
    const strikes = Array.from(new Set(calls.map((q) => q.strike))).sort((a, b) => a - b);
    const rows = dtes.map((d) => ({
      dte: d,
      cells: strikes.map((k) => {
        const q = calls.find((x) => x.dte_days === d && x.strike === k);
        return { strike: k, iv: q?.iv ?? null };
      }),
    }));
    const flat = rows.flatMap((r) => r.cells.map((c) => c.iv).filter((v): v is number => v != null));
    return {
      rows,
      ivRange: [Math.min(...flat), Math.max(...flat)] as [number, number],
    };
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="rounded-lg border border-hair bg-panel/50 p-8 text-center text-sm text-muted shadow-inset">
        Awaiting first snapshot…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hair bg-panel/50 shadow-inset">
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h2 className="rule-caret font-display text-xl leading-none">Implied-Vol Surface</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          calls · rows = DTE · cols = strike
        </span>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full border-separate border-spacing-[2px]">
          <thead>
            <tr>
              <th className="w-14 pr-3 text-right text-[10px] font-normal uppercase tracking-wider text-faint">
                DTE
              </th>
              {rows[0]?.cells.map((c) => (
                <th
                  key={c.strike}
                  className="min-w-[42px] px-1 pb-1 font-mono text-[10px] font-normal text-faint"
                >
                  {c.strike}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dte}>
                <td className="w-14 pr-3 text-right font-mono text-[11px] text-muted">
                  {r.dte}d
                </td>
                {r.cells.map((c) => (
                  <td
                    key={c.strike}
                    className="min-w-[42px] rounded-sm text-center font-mono text-[10px] tabular-nums"
                    style={{
                      background: c.iv != null ? heatColor(c.iv, ivRange) : "transparent",
                      color: c.iv != null && c.iv > 0.6 * (ivRange[1] - ivRange[0]) + ivRange[0]
                        ? "#0a0908"
                        : "#f2eee2",
                      padding: "6px 4px",
                    }}
                  >
                    {c.iv != null ? `${(c.iv * 100).toFixed(0)}` : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-wider text-faint">
          <span>IV range:</span>
          <div className="h-1.5 flex-1 rounded-full" style={{
            background: `linear-gradient(90deg, ${heatColor(ivRange[0], ivRange)}, ${heatColor(ivRange[1], ivRange)})`,
          }} />
          <span className="font-mono tnum text-muted">
            {(ivRange[0] * 100).toFixed(0)}% → {(ivRange[1] * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Warm heat: dim brown → copper → amber → cream. Not the standard viridis-y
// palette anyone recognizes — that's the point.
function heatColor(v: number, [lo, hi]: [number, number]): string {
  if (hi === lo) return "rgba(201, 111, 52, 0.15)";
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  // Interpolate in HSL: hue 20 (warm brown) → 32 (amber), lightness up.
  const l = 12 + t * 45;
  const s = 30 + t * 40;
  return `hsl(28, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}
