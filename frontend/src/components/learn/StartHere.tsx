// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Term } from "@/components/ui/Term";

const KEY = "poption.starthere.dismissed";

/**
 * First-visit onboarding card — builds options from zero using the Term
 * component so every jargon word inside the card is itself a click-away
 * from a full explanation. Dismissed state persists to localStorage; a
 * discreet "Start here" toggle in the top corner lets the user reopen it.
 */
export function StartHere() {
  const [dismissed, setDismissed] = useState(true); // assume dismissed until localStorage reads

  useEffect(() => {
    setDismissed(window.localStorage.getItem(KEY) === "1");
  }, []);

  const dismiss = () => {
    setDismissed(true);
    window.localStorage.setItem(KEY, "1");
  };
  const reopen = () => {
    setDismissed(false);
    window.localStorage.removeItem(KEY);
  };

  if (dismissed) {
    return (
      <button
        onClick={reopen}
        className="text-[10px] uppercase tracking-[0.18em] text-faint transition-colors hover:text-copper"
      >
        Start here
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -12, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="mx-auto mt-4 max-w-[1600px] px-4 lg:px-6"
      >
        <div className="relative overflow-hidden rounded-lg border border-copper/25 bg-panel/70 p-6 shadow-inset">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(600px 200px at 10% -30%, rgba(201, 111, 52, 0.18), transparent 70%)",
            }}
          />
          <button
            onClick={dismiss}
            className="absolute right-4 top-4 rounded-md border border-hair px-2 py-1 text-[10px] uppercase tracking-wider text-faint hover:border-rose/40 hover:text-rose"
            aria-label="Dismiss"
          >
            Dismiss
          </button>

          <div className="relative">
            <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-copper">
              Start here — you don't need to know options
            </div>
            <h2 className="font-display text-3xl leading-tight text-ink">
              What am I looking at?
            </h2>
            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted">
              Poption is a place to learn options by watching the tape. Every
              underlined word is clickable — three-part explanation (what it
              is, why veterans watch it, when it lies to you). Try one now.
            </p>

            <ol className="mt-5 grid gap-4 text-[13px] leading-relaxed text-muted lg:grid-cols-2">
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-copper">01</span>
                <span>
                  An <Term k="option">option</Term> is the right (not the
                  obligation) to buy or sell 100 shares at a fixed{" "}
                  <Term k="strike">strike</Term> before a specific{" "}
                  <Term k="expiry">expiry</Term> — a{" "}
                  <Term k="call">call</Term> for buying,{" "}
                  <Term k="put">put</Term> for selling.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-copper">02</span>
                <span>
                  The <strong className="text-ink">spot line</strong> up top is
                  the underlying. The <strong className="text-ink">IV
                  surface</strong> below is what the market thinks it'll do —
                  hotter cells = higher{" "}
                  <Term k="implied_volatility">implied volatility</Term> =
                  pricier options.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-copper">03</span>
                <span>
                  The <strong className="text-ink">anomaly feed</strong> fires
                  when a signal — an <Term k="iv_spike_kind">IV spike</Term>, a{" "}
                  <Term k="pc_ratio_shift_kind">P/C shift</Term>, or a{" "}
                  <Term k="vol_oi_divergence_kind">vol/OI divergence</Term> —
                  moves several standard deviations from its rolling window.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-copper">04</span>
                <span>
                  Click a fire → the drawer opens. Four tabs:{" "}
                  <strong className="text-ink">how to read</strong> the number,
                  what the three <strong className="text-ink">desk
                  personas</strong> (
                  <Term k="market_maker">market maker</Term>,{" "}
                  <Term k="directional_trader">directional</Term>,{" "}
                  <Term k="vol_trader">vol</Term>) typically put on,
                  Claude-narrated forensics, and a stream of historical
                  analogues.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-copper">05</span>
                <span>
                  <em className="text-ink">Try one</em>: pick a scenario above
                  (COVID, GME, or SVB) and watch the same detector fire on the
                  same pattern the real event left behind.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-copper">06</span>
                <span>
                  See a persona trade you want to remember? Hit{" "}
                  <strong className="text-ink">Watch this play out</strong> —
                  the trade becomes a study card you can come back to later
                  and see how it would have done. Simulator only, never sends
                  anywhere.
                </span>
              </li>
            </ol>

            <p className="mt-6 text-[11px] italic text-faint">
              Analysis-only demo. Synthetic data. Not financial advice.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
