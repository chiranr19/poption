import type { AnomalyKind } from "@/lib/types";
import { PLAYBOOK, type PersonaKey } from "@/lib/playbook";
import { Term } from "@/components/ui/Term";

const PERSONA_META: Record<PersonaKey, { title: string; termKey: string; tone: string }> = {
  market_maker: { title: "Market Maker", termKey: "market_maker", tone: "text-muted" },
  directional_trader: { title: "Directional Trader", termKey: "directional_trader", tone: "text-copper" },
  vol_trader: { title: "Vol Trader", termKey: "vol_trader", tone: "text-amber" },
};

/**
 * Conceptual playbook: what each desk persona typically watches, how they
 * typically react, and what they're risking. Concrete trade structures live
 * in PersonaTrades — this one is about the mental model.
 */
export function Playbook({ kind }: { kind: AnomalyKind }) {
  const entries = PLAYBOOK[kind];
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-copper">
        What each desk typically does
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(entries) as PersonaKey[]).map((pk) => {
          const meta = PERSONA_META[pk];
          const entry = entries[pk];
          return (
            <div
              key={pk}
              className="rounded-md border border-hair bg-elev/40 p-3.5"
            >
              <div className={`font-display text-lg italic ${meta.tone}`}>
                <Term k={meta.termKey}>{meta.title}</Term>
              </div>
              <div className="mt-2.5 space-y-2 text-[11.5px] leading-snug text-muted">
                <Row label="Watching">{entry.watching}</Row>
                <Row label="Typical reaction">{entry.reaction}</Row>
                <Row label="What they're risking">{entry.risk}</Row>
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
      <p>{children}</p>
    </div>
  );
}
