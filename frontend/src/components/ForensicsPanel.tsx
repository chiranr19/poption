// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import type { Anomaly, ForensicsResponse } from "@/lib/types";

export function ForensicsPanel({
  anomaly,
  forensics,
  onClose,
}: {
  anomaly: Anomaly;
  forensics: ForensicsResponse | null;
  onClose: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row">
      {/* Left: the narrative */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-copper">
              Forensic Report
            </div>
            <h3 className="mt-1 font-display text-3xl leading-tight">
              {anomaly.headline}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-hair px-3 py-1 text-[11px] uppercase tracking-wider text-muted hover:border-rose/40 hover:text-rose"
          >
            Close
          </button>
        </div>

        {forensics ? (
          <>
            <GroundingBadge grounding={forensics.grounding} />
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {forensics.text}
            </p>
          </>
        ) : (
          <div className="my-6 flex items-center gap-3 text-sm text-muted">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-copper" />
            Synthesizing forensic narrative…
          </div>
        )}
      </div>

      {/* Right: numeric evidence panel + historical analogues */}
      <div className="lg:w-[380px] lg:shrink-0">
        <EvidenceBlock anomaly={anomaly} />
        <AnaloguesBlock analogues={forensics?.analogues ?? []} />
      </div>
    </div>
  );
}

function GroundingBadge({ grounding }: { grounding: ForensicsResponse["grounding"] }) {
  if (grounding.ok) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-sage/40 bg-sage/10 px-2.5 py-1 text-[11px] text-sage">
        <span className="h-1.5 w-1.5 rounded-full bg-sage" />
        Grounded — every number cited traces to the detector's payload
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-rose/40 bg-rose/10 px-2.5 py-1 text-[11px] text-rose">
      <span className="h-1.5 w-1.5 rounded-full bg-rose" />
      Ungrounded output detected — {grounding.unknown_numbers.length} unknown numbers,
      {" "}
      {grounding.advice_hits.length} advice phrases
    </div>
  );
}

function EvidenceBlock({ anomaly }: { anomaly: Anomaly }) {
  const rows: [string, string][] = [
    ["symbol", anomaly.symbol],
    ["kind", anomaly.kind],
    ["z-score", `${anomaly.z_score.toFixed(2)}σ`],
    ["observed", `${anomaly.observed}`],
    ["baseline μ", `${anomaly.baseline_mean}`],
    ["baseline σ", `${anomaly.baseline_std}`],
    ["confidence", `${anomaly.confidence.toFixed(0)} / 100`],
  ];
  return (
    <div className="rounded-md border border-hair bg-elev/40 p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-faint">
        Evidence
      </div>
      <table className="w-full font-mono text-[12px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="w-[110px] py-1 text-muted">{k}</td>
              <td className="py-1 tnum text-ink">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnaloguesBlock({ analogues }: { analogues: ForensicsResponse["analogues"] }) {
  if (!analogues.length) return null;
  return (
    <div className="mt-4 rounded-md border border-hair bg-elev/40 p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-faint">
        Historical analogues
      </div>
      <div className="space-y-3">
        {analogues.map((a) => (
          <div key={a.id} className="border-l-2 border-copper/40 pl-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-[15px] italic text-ink">{a.title}</span>
              <span className="font-mono text-[10px] text-faint">{a.date}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{a.lesson}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
