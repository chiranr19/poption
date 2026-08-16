import { useMemo } from "react";
import type { ChainSnapshot } from "@/lib/types";
import {
  closeCard,
  markToMarket,
  removeCard,
  updateCard,
  type StudyCard,
} from "@/lib/studycards";

/**
 * The Watching / Retrospective sidebar. Reads Study Cards from state (kept
 * in App via localStorage), marks each open card against the current
 * snapshot on every render, and offers Close now / Delete controls. Closed
 * cards show the retrospective — entry vs exit, realized P&L, dominant
 * Greek, and the deterministic lesson.
 */
export function StudyCards({
  cards,
  snapshot,
  onChange,
}: {
  cards: StudyCard[];
  snapshot: ChainSnapshot | null;
  onChange: (next: StudyCard[]) => void;
}) {
  const open = useMemo(() => cards.filter((c) => c.status === "open"), [cards]);
  const closed = useMemo(() => cards.filter((c) => c.status === "closed"), [cards]);

  const handleClose = (id: string) => {
    if (!snapshot) return;
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const next = updateCard(id, () => closeCard(card, snapshot, "user_closed"));
    onChange(next);
  };

  const handleDelete = (id: string) => {
    const next = removeCard(id);
    onChange(next);
  };

  if (cards.length === 0) {
    return (
      <div className="p-6 text-center text-[13px] text-muted">
        <div className="font-display text-lg italic text-ink">
          Nothing tagged yet.
        </div>
        <p className="mt-2 text-[12px]">
          On any anomaly, open the <strong className="text-ink">Persona
          trades</strong> tab and hit <strong className="text-ink">Watch this
          play out</strong> to tag a persona's structured trade. It'll show up
          here with live mark-to-market. Simulator only — nothing ever routes
          to a broker.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {open.length > 0 && (
        <section>
          <SectionHead label="Watching" count={open.length} />
          <div className="mt-2 space-y-2">
            {open.map((c) => (
              <OpenCard
                key={c.id}
                card={c}
                snapshot={snapshot}
                onClose={() => handleClose(c.id)}
                onDelete={() => handleDelete(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <SectionHead label="Retrospective" count={closed.length} />
          <div className="mt-2 space-y-2">
            {closed.map((c) => (
              <ClosedCard key={c.id} card={c} onDelete={() => handleDelete(c.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-hair pb-1">
      <span className="rule-caret font-display text-lg leading-none">
        {label}
      </span>
      <span className="font-mono tnum text-[10px] uppercase tracking-[0.14em] text-faint">
        {count}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Open card — live mark-to-market
// --------------------------------------------------------------------------- //

function OpenCard({
  card,
  snapshot,
  onClose,
  onDelete,
}: {
  card: StudyCard;
  snapshot: ChainSnapshot | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  const live = snapshot ? markToMarket(card, snapshot) : null;
  const pnl = live?.unrealized_pnl ?? 0;
  const pnlTone = pnl > 0 ? "text-sage" : pnl < 0 ? "text-rose" : "text-muted";

  return (
    <div className="rounded-md border border-copper/25 bg-elev/50 p-3">
      <CardHeader card={card} />
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="Entry mid" value={`$${card.entry_debit.toFixed(2)}`} />
        <Stat
          label="Current mark"
          value={live ? `$${live.current_mid.toFixed(2)}` : "—"}
        />
        <Stat
          label="Unrealized"
          value={live ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—"}
          tone={pnlTone}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="Entry spot" value={`$${card.entry_spot.toFixed(2)}`} />
        <Stat
          label="Now spot"
          value={snapshot ? `$${snapshot.spot.toFixed(2)}` : "—"}
        />
        <Stat
          label="DTE"
          value={live ? String(live.days_remaining) : String(card.legs[0].entry_dte)}
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onClose}
          disabled={!snapshot}
          className="flex-1 rounded-md border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] font-medium text-amber transition-colors hover:bg-amber/15 disabled:opacity-40"
        >
          Close now
        </button>
        <button
          onClick={onDelete}
          className="rounded-md border border-hair px-2 py-1.5 text-[11px] text-faint hover:border-rose/40 hover:text-rose"
        >
          Delete
        </button>
      </div>
      <div className="mt-2 text-center text-[9px] uppercase tracking-[0.14em] text-faint">
        Simulator only
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Closed card — retrospective
// --------------------------------------------------------------------------- //

function ClosedCard({ card, onDelete }: { card: StudyCard; onDelete: () => void }) {
  const out = card.outcome!;
  const won = out.realized_pnl > 0;
  const pnlTone = won ? "text-sage" : out.realized_pnl < 0 ? "text-rose" : "text-muted";

  return (
    <div className={`rounded-md border p-3 ${won ? "border-sage/30 bg-sage/5" : "border-hair bg-elev/30"}`}>
      <CardHeader card={card} />
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="Entry spot" value={`$${card.entry_spot.toFixed(2)}`} />
        <Stat label="Exit spot" value={`$${out.exit_spot.toFixed(2)}`} />
        <Stat label="Entry mid" value={`$${card.entry_debit.toFixed(2)}`} />
        <Stat label="Exit mid" value={`$${out.exit_mid.toFixed(2)}`} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <Stat
          label="Realized"
          value={`${out.realized_pnl >= 0 ? "+" : ""}$${out.realized_pnl.toFixed(2)}`}
          tone={pnlTone}
        />
        <Stat label="Dominant Greek" value={out.dominant_greek} tone="text-copper" />
      </div>

      <div className="mt-3 rounded border border-hair bg-bg/30 p-2.5 text-[11px] leading-relaxed text-muted">
        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-copper">
          Lesson
        </div>
        {out.lesson}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onDelete}
          className="rounded-md border border-hair px-2 py-1.5 text-[10px] text-faint hover:border-rose/40 hover:text-rose"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Shared bits
// --------------------------------------------------------------------------- //

function CardHeader({ card }: { card: StudyCard }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-copper">
          {card.persona_title} · {card.trade_kind.replace(/_/g, " ")}
        </div>
        <div className="mt-0.5 text-[11.5px] italic text-ink">
          {card.trade_view}
        </div>
      </div>
      <div className="text-right text-[9px] uppercase tracking-[0.14em] text-faint">
        anomaly<br />
        <span className="font-mono text-muted">{card.anomaly_kind}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
      <div className={`font-mono tnum text-[12px] ${tone}`}>{value}</div>
    </div>
  );
}
