// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import { useEffect, useState } from "react";
import type { Anomaly, ChainSnapshot } from "@/lib/types";
import { Term } from "@/components/ui/Term";
import {
  addCard,
  netDebit,
  newId,
  structureLegsForPersona,
  type PersonaKey,
  type StudyCard,
} from "@/lib/studycards";

interface PersonaRow {
  persona: string;
  title: string;
  philosophy: string;
  view: string;
  structure: string;
  example_position: string;
  max_risk: string;
  typical_horizon: string;
  rationale: string;
}

interface PersonaBundle {
  kind: string;
  personas: PersonaRow[];
}

const TERM_KEY_FOR: Record<string, string> = {
  market_maker: "market_maker",
  directional_trader: "directional_trader",
  vol_trader: "vol_trader",
};

const TONE_FOR: Record<string, string> = {
  market_maker: "text-muted",
  directional_trader: "text-copper",
  vol_trader: "text-amber",
};

/**
 * Concrete opinionated persona trades — the "given this anomaly, here's
 * what a directional trader would put on" surface. Every card carries a
 * "Watch this play out" button that snapshots the trade to a Study Card;
 * every card also carries the persistent "Simulator only" chip.
 *
 * Copy stays third-person portraits: "a directional-bullish desk would
 * typically structure..." — descriptions of pro behavior, not instructions
 * to the reader. The CI test on the backend corpus enforces this.
 */
export function PersonaTrades({
  anomaly,
  snapshot,
  onCardCreated,
}: {
  anomaly: Anomaly;
  snapshot: ChainSnapshot | null;
  onCardCreated?: (card: StudyCard) => void;
}) {
  const [bundle, setBundle] = useState<PersonaBundle | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setBundle(null);
    setConfirmed({});
    fetch(`/api/personas/${anomaly.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setBundle(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [anomaly.id]);

  const handleWatch = (row: PersonaRow) => {
    if (!snapshot) return;
    setCreating(row.persona);
    const structured = structureLegsForPersona(
      row.persona as PersonaKey,
      anomaly.kind,
      snapshot,
    );
    if (!structured) {
      setCreating(null);
      return;
    }
    const card: StudyCard = {
      id: newId(),
      created_at: Date.now(),
      entry_sim_ts: snapshot.ts,
      entry_spot: snapshot.spot,
      entry_iv: null,
      entry_regime: snapshot.regime,
      anomaly_id: anomaly.id,
      anomaly_kind: anomaly.kind,
      persona: row.persona as PersonaKey,
      persona_title: row.title,
      trade_kind: structured.kind,
      trade_view: structured.view,
      legs: structured.legs,
      entry_debit: netDebit(structured.legs),
      max_risk_note: row.max_risk,
      status: "open",
    };
    addCard(card);
    onCardCreated?.(card);
    setConfirmed((c) => ({ ...c, [row.persona]: true }));
    setCreating(null);
  };

  if (!bundle) {
    return (
      <div className="rounded-md border border-hair bg-elev/30 p-4 text-sm text-muted">
        Fetching persona trades…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-copper">
            Concrete trades — what each desk would typically put on
          </div>
          <p className="mt-0.5 text-[11px] italic text-faint">
            Third-person portrayals of professional behavior. Descriptions of
            what pros typically do — never a recommendation to you.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {bundle.personas.map((row) => {
          const tone = TONE_FOR[row.persona] ?? "text-ink";
          const isConfirmed = confirmed[row.persona];
          return (
            <div
              key={row.persona}
              className="flex flex-col rounded-md border border-hair bg-elev/40 p-3.5"
            >
              <div className={`font-display text-lg italic ${tone}`}>
                <Term k={TERM_KEY_FOR[row.persona] ?? row.persona}>
                  {row.title}
                </Term>
              </div>
              <div className="mt-2.5 space-y-2 text-[11.5px] leading-snug text-muted">
                <Row label="View">{row.view}</Row>
                <Row label="Structure">{row.structure}</Row>
                <Row label="Example position">
                  <code className="tnum block whitespace-pre-wrap font-mono text-[11px] text-ink">
                    {row.example_position}
                  </code>
                </Row>
                <Row label="Max risk">
                  <span className="text-rose/90">{row.max_risk}</span>
                </Row>
                <Row label="Typical horizon">
                  <span className="tnum font-mono">{row.typical_horizon}</span>
                </Row>
                <Row label="Rationale">{row.rationale}</Row>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <button
                  disabled={!snapshot || creating === row.persona || isConfirmed}
                  onClick={() => handleWatch(row)}
                  className={`rounded-md border px-3 py-2 text-[11px] font-medium tracking-wide transition-colors ${
                    isConfirmed
                      ? "border-sage/40 bg-sage/10 text-sage cursor-default"
                      : "border-copper/40 bg-copper/10 text-copper hover:bg-copper/15"
                  } ${!snapshot ? "opacity-50" : ""}`}
                >
                  {isConfirmed
                    ? "Added to Watching →"
                    : creating === row.persona
                      ? "Structuring…"
                      : "Watch this play out"}
                </button>
                <div className="text-center text-[9px] uppercase tracking-[0.14em] text-faint">
                  Simulator only · never routes to a broker
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[9px] uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
