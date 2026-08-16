import { useEffect, useState } from "react";
import { Term } from "@/components/ui/Term";

/**
 * A compact primer sitting under the IV heatmap: what happens to a long
 * call / long put / short call / short put when spot moves, when IV moves,
 * as time passes. Deterministic; explains the Greek relationships in
 * English. Toggle persists to localStorage so the user isn't nagged.
 */
export function PnLMechanics() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(window.localStorage.getItem("poption.pnl.open") === "1");
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem("poption.pnl.open", next ? "1" : "0");
  };

  return (
    <div className="rounded-md border border-hair bg-elev/20 shadow-inset">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="rule-caret font-display text-lg leading-none">
          P&amp;L primer
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
          {open ? "hide" : "show"} — what wins, what loses
        </span>
      </button>
      {open && (
        <div className="border-t border-hair px-4 py-4">
          <p className="text-[12px] leading-relaxed text-muted">
            An option's price is driven by three levers: how much the underlying
            moves (<Term k="delta">delta</Term> / <Term k="gamma">gamma</Term>),
            how much <Term k="implied_volatility">IV</Term> moves
            (<Term k="vega">vega</Term>), and how much time passes
            (<Term k="theta">theta</Term>). Every position is long some of these
            and short others.
          </p>

          <table className="mt-4 w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-[0.14em] text-faint">
                <th className="pb-2">Position</th>
                <th className="pb-2 text-center">Spot up</th>
                <th className="pb-2 text-center">Spot down</th>
                <th className="pb-2 text-center">IV up</th>
                <th className="pb-2 text-center">Time passes</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {ROWS.map((r) => (
                <tr key={r.name} className="border-t border-hair/40">
                  <td className="py-1.5 font-medium text-ink">{r.name}</td>
                  <td className="text-center">{cell(r.spotUp)}</td>
                  <td className="text-center">{cell(r.spotDn)}</td>
                  <td className="text-center">{cell(r.ivUp)}</td>
                  <td className="text-center">{cell(r.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4 text-[11px] italic text-faint">
            Table shows sign only, not magnitude. The size of each move depends
            on the option's strike, DTE, and moneyness — that's what the Greeks
            actually measure.
          </p>
        </div>
      )}
    </div>
  );
}

type Sign = 1 | -1 | 0;
interface Row {
  name: string;
  spotUp: Sign;
  spotDn: Sign;
  ivUp: Sign;
  time: Sign;
}

const ROWS: Row[] = [
  { name: "Long call", spotUp: 1, spotDn: -1, ivUp: 1, time: -1 },
  { name: "Long put", spotUp: -1, spotDn: 1, ivUp: 1, time: -1 },
  { name: "Short call", spotUp: -1, spotDn: 1, ivUp: -1, time: 1 },
  { name: "Short put", spotUp: 1, spotDn: -1, ivUp: -1, time: 1 },
];

function cell(s: Sign) {
  if (s === 1) return <span className="text-sage">+</span>;
  if (s === -1) return <span className="text-rose">−</span>;
  return <span className="text-faint">·</span>;
}
