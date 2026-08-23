// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import type { AnomalyKind } from "@/lib/types";
import { HOW_TO_READ } from "@/lib/howToRead";
import { Term } from "@/components/ui/Term";

const KIND_TERM_KEY: Record<AnomalyKind, string> = {
  iv_spike: "iv_spike_kind",
  pc_ratio_shift: "pc_ratio_shift_kind",
  vol_oi_divergence: "vol_oi_divergence_kind",
};

/**
 * Deterministic four-part breakdown that sits above the LLM narrative in
 * the drawer. Every anomaly kind gets: the literal reading of the number,
 * the mechanism it points to, what typically follows, and the specific
 * failure mode. Hand-written copy — the same regex the persona corpus uses
 * for advice-language would also reject anything here that drifts.
 */
export function HowToRead({ kind }: { kind: AnomalyKind }) {
  const entry = HOW_TO_READ[kind];
  const sections: [string, string, string][] = [
    ["What the number literally says", entry.literal, "text-ink"],
    ["The mechanism behind it", entry.mechanism, "text-muted"],
    ["What typically follows", entry.typicallyFollows, "text-muted"],
    ["When this reading is wrong", entry.failsWhen, "text-rose/90"],
  ];
  return (
    <div className="rounded-md border border-hair bg-elev/30 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-copper">
            How to read this
          </div>
          <h3 className="mt-0.5 font-display text-xl italic text-ink">
            Reading a <Term k={KIND_TERM_KEY[kind]}>{kind.replace(/_/g, " ")}</Term>
          </h3>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map(([label, body, tone]) => (
          <div key={label}>
            <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-faint">
              {label}
            </div>
            <p className={`text-[12px] leading-relaxed ${tone}`}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
