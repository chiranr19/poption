// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
/**
 * Deterministic "how to read this" copy per anomaly kind — sits *above* the
 * LLM forensics narrative so beginners have four concrete labelled sections
 * they can rely on before the streamed prose lands.
 *
 * Hand-written, no advice language, structured (not free text) so a lint
 * pass can walk every field and check for FORBIDDEN phrases if we ever
 * decide to port that test to the frontend.
 */

import type { AnomalyKind } from "./types";

export interface HowToReadEntry {
  literal: string;         // what the number itself says, plain-English
  mechanism: string;       // what mechanism the pattern points to
  typicallyFollows: string; // what tends to happen next, in aggregate
  failsWhen: string;       // the pattern's failure mode — what makes this signal wrong
}

export const HOW_TO_READ: Record<AnomalyKind, HowToReadEntry> = {
  iv_spike: {
    literal:
      "The at-the-money implied volatility has jumped multiple standard deviations above its recent rolling window. Options across the surface just got sharply more expensive relative to what they were pricing a few minutes ago.",
    mechanism:
      "IV rises when demand for optionality outpaces supply. That usually means someone knows or fears something the tape hasn't shown yet — protection buyers moving fast, or news breaking that dealers haven't fully absorbed.",
    typicallyFollows:
      "Across historical episodes, IV spikes usually resolve one of two ways: the underlying moves enough to justify the pop and IV stays elevated, or the fear proves unfounded and IV crushes back within days. The magnitude of the spike is a poor predictor of which one.",
    failsWhen:
      "Scheduled events (earnings, FOMC meetings) produce predictable IV pops that aren't really anomalies — the professional workflow suppresses them; this detector does not yet. If a fire coincides with a known scheduled event, treat it as noise.",
  },
  pc_ratio_shift: {
    literal:
      "The near-dated put/call volume ratio has moved multiple standard deviations from its recent baseline. Positioning is materially different from what it looked like an hour ago.",
    mechanism:
      "Put-heavy shifts typically reflect either fear (hedging demand) or informed bearish positioning ahead of a catalyst. Call-heavy shifts often mark bullish speculation or short-covering pressure. Reading it correctly requires pairing with the underlying's direction and the IV response.",
    typicallyFollows:
      "Ratio shifts that come with a matching IV move (put-heavy + rising IV, or call-heavy + rising IV) tend to be more meaningful — the two together suggest genuine repositioning. Ratio moves without IV confirmation are more often mechanical flow.",
    failsWhen:
      "Large institutional hedging can produce a put-heavy signal that has nothing to do with sentiment — someone buying protection on a long position they intend to keep. Without knowing the buyer, the ratio is easy to misread.",
  },
  vol_oi_divergence: {
    literal:
      "Today's option volume is running many standard deviations above open interest. New positioning is opening faster than existing positions are closing — a lot of fresh bets are being placed.",
    mechanism:
      "Vol/OI divergences point to informed flow — someone with a view is opening positions before the OI has caught up. Historically, these often precede realized-vol expansion within a session or two.",
    typicallyFollows:
      "Roughly two-thirds of divergences historically resolve with a meaningful spot move in the direction the new OI is opening. The lead time is short — typically hours to days.",
    failsWhen:
      "Illiquid strikes with tiny OI produce huge vol/OI ratios from routine flow. The signal only carries weight where OI is meaningful. Also: heavy hedging around scheduled events (earnings) can spike vol/OI without being informational.",
  },
};
