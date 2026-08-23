// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A one-line promise under the wordmark, with a click-through modal that
 * spells out the two guarantees that make Poption credible:
 *
 *   1. Grounded — every number the LLM cites traces back to the detector's
 *      payload. Enforced by a CI test, not a policy.
 *   2. No advice — every hand-written copy corpus (learning panels, persona
 *      trades) is scanned by the same regex that blocks advice-like
 *      language in the LLM output. Enforced by tests.
 *
 * These aren't marketing — they're the mechanism that lets the same repo
 * ship confident opinionated persona-trade suggestions without pretending
 * to be a broker.
 */
export function GuaranteesRibbon() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] uppercase tracking-[0.18em] text-faint transition-colors hover:text-copper"
      >
        <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-sage" />
        Grounded. No advice.{" "}
        <span className="text-copper/70">Read the guarantee →</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-50 mt-3 w-[420px] rounded-lg border border-copper/25 bg-elev p-5 text-left shadow-glow"
          >
            <div className="text-[9px] uppercase tracking-[0.22em] text-copper">
              What we promise, in code
            </div>
            <h3 className="mt-1 font-display text-2xl italic text-ink">
              Two guardrails
            </h3>

            <div className="mt-4 space-y-4 text-[12px] leading-relaxed text-muted">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-sage">
                  Grounded
                </div>
                Every number the LLM cites is checked against the detector's
                payload. Invented figures fail a CI test that runs on every
                commit — the guarantee is code, not a marketing line.
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-sage">
                  No advice
                </div>
                Every hand-written copy corpus — learning panels, persona
                trades, even the onboarding — is walked by a regex that fails
                the build on second-person imperatives (<em className="text-ink">you should</em>),
                absolute predictions (<em className="text-ink">will rise</em>), or trading
                instructions (<em className="text-ink">buy this</em>). Persona trades stay in
                third-person portraits (<em className="text-ink">a directional desk would
                typically…</em>) — descriptions, not directions.
              </div>
              <div className="pt-2 text-[11px] text-faint">
                Analysis-only demo. Synthetic data. Never routes to a broker.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
