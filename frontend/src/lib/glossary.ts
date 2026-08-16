/**
 * The learning-layer glossary. Every jargon word on the dashboard resolves
 * to an entry here via the <Term k="..."> component. Each entry follows the
 * three-part shape borrowed from Stocky's learning layer:
 *
 *   what:            plain-English description with zero jargon
 *   whyVetsWatchIt:  what makes it load-bearing in professional analysis
 *   whenItLies:      the specific failure mode that trips up beginners
 *
 * The corpus is deliberately hand-written, not generated. No advice
 * language — descriptions of mechanisms only.
 */

export interface GlossaryEntry {
  term: string;
  what: string;
  whyVetsWatchIt: string;
  whenItLies: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ---- Options fundamentals --------------------------------------------
  option: {
    term: "Option",
    what: "A contract giving you the right (but not the obligation) to buy or sell 100 shares of a stock at a fixed price, before a specific date. You pay a premium up front for that right.",
    whyVetsWatchIt: "Options let you take a view with defined risk (the premium) and much smaller capital than owning the shares outright. They also let you sell insurance to other people, which is where a huge share of professional profit comes from.",
    whenItLies: "The premium is a real cost. If nothing happens between now and expiry, options usually go to zero — being 'right' late doesn't help if the option expires first.",
  },
  call: {
    term: "Call",
    what: "An option that gives you the right to *buy* 100 shares at a fixed price (the strike). You buy calls when you think the stock is going up.",
    whyVetsWatchIt: "A call's payoff is unlimited on the upside and capped at the premium on the downside — the classic defined-risk way to express a bullish view.",
    whenItLies: "Being bullish and buying calls are not the same trade. Time decay eats calls every day, and implied volatility can drop even when spot rises — either can turn a correctly-directional call into a loss.",
  },
  put: {
    term: "Put",
    what: "An option that gives you the right to *sell* 100 shares at a fixed price. You buy puts when you think the stock is going down, or as insurance on shares you own.",
    whyVetsWatchIt: "Puts are how professionals hedge — one put contract offsets 100 shares of downside. Persistent put demand is one of the clearest signals of institutional fear.",
    whenItLies: "Puts get expensive fast when everyone else is scared. Buying puts *after* a big drop often means paying peak premium into an IV crush.",
  },
  strike: {
    term: "Strike",
    what: "The fixed price at which an option lets you buy (call) or sell (put) the underlying. Every option chain is a grid of strikes.",
    whyVetsWatchIt: "Choosing the strike is choosing your leverage and your break-even. A strike far from spot is cheap but needs a big move; a strike near spot is expensive but works on a small move.",
    whenItLies: "OTM (far-from-spot) strikes look tempting because they're cheap — but 'cheap' means the market thinks the odds are low. Most OTM options expire worthless.",
  },
  expiry: {
    term: "Expiry / DTE",
    what: "The date the option contract terminates. 'DTE' = days to expiry. After the expiry date, the option is worth only its intrinsic value (zero if it's out-of-the-money).",
    whyVetsWatchIt: "Short-dated options are more sensitive to spot moves (high gamma) but decay faster (high theta). Long-dated options are steadier but tie up capital longer.",
    whenItLies: "Weekly expiries offer huge leverage but are gambles more than trades — a good directional read can still expire worthless if the move happens one day late.",
  },
  moneyness: {
    term: "Moneyness",
    what: "How far the strike is from the current spot price. 'ITM' (in-the-money) has intrinsic value; 'ATM' (at-the-money) is right at spot; 'OTM' (out-of-the-money) has none.",
    whyVetsWatchIt: "Moneyness controls how the option behaves. ATM options carry the most time value; OTM options are pure lottery tickets with low probability but high payout.",
    whenItLies: "Delta ≈ probability of finishing ITM is a rule of thumb, not a fact. It's biased in ways that matter when you're pricing tails.",
  },
  intrinsic_value: {
    term: "Intrinsic value",
    what: "What the option would be worth if it expired right now — the amount by which it's in-the-money. Zero for OTM options.",
    whyVetsWatchIt: "Intrinsic and time value together make up the premium. When time value collapses to zero at expiry, intrinsic is all that's left.",
    whenItLies: "An option with lots of intrinsic value trades close to its intrinsic — the leverage vs the stock shrinks the deeper ITM you go.",
  },
  time_value: {
    term: "Time value",
    what: "The premium above intrinsic value. It reflects the market's estimate of what could still happen before expiry. Theta is the rate at which this drains away.",
    whyVetsWatchIt: "Time value is where implied volatility lives. When you sell an option, you're selling time value; when you buy one, that's most of what you're paying for.",
    whenItLies: "Time value doesn't decay linearly. It accelerates in the final weeks and can collapse overnight after a scheduled event (earnings, FOMC).",
  },

  // ---- The Greeks ------------------------------------------------------
  delta: {
    term: "Delta",
    what: "How much the option's price changes for a $1 move in the underlying. Ranges 0 to 1 for calls, -1 to 0 for puts. A 30-delta call moves ~$0.30 for every $1 spot moves.",
    whyVetsWatchIt: "Delta is the closest thing to 'how much stock am I effectively long'. Market makers add up all their deltas across the book and hedge with the underlying to stay directionally flat.",
    whenItLies: "Delta itself moves — that's gamma. What was a 30-delta call becomes a 60-delta call after a rally, so the exposure grows or shrinks with spot.",
  },
  gamma: {
    term: "Gamma",
    what: "How much delta changes per $1 move in spot. High gamma means your directional exposure changes fast — the option becomes very responsive near the strike.",
    whyVetsWatchIt: "Gamma is highest for near-expiry, near-ATM options. It's what makes 0DTE trading so violent and why market makers price weekly straddles carefully.",
    whenItLies: "Long gamma feels great on the way in — every move helps — until you realize you also paid theta for it. Short gamma feels great collecting premium until spot moves quickly.",
  },
  theta: {
    term: "Theta",
    what: "How much the option loses per day just from time passing, all else equal. Long options have negative theta; short options collect positive theta.",
    whyVetsWatchIt: "Theta is why 'time is money' in options. Long-option positions bleed daily even when nothing happens; short-option positions earn it.",
    whenItLies: "Theta accelerates as expiry approaches. A short position that felt safe with 30 days left can decay into a scary gamma exposure with 5 days left.",
  },
  vega: {
    term: "Vega",
    what: "How much the option's price changes for a 1-point move in implied volatility. Long options are long vega (help when IV rises); short options are short vega.",
    whyVetsWatchIt: "Vega is what vol traders actually trade. Selling premium in high-IV regimes and buying it in low-IV regimes is the mean-reversion trade the whole vol-desk business runs on.",
    whenItLies: "Vega isn't constant. It's biggest for ATM, long-dated options — a short-dated OTM position can be nearly flat vega even though it's very sensitive to spot.",
  },
  rho: {
    term: "Rho",
    what: "How much the option changes per 1% move in interest rates. Small enough that most retail traders can ignore it — unless rates are moving fast.",
    whyVetsWatchIt: "Long-dated options carry meaningful rho. During 2022's rate-shock year, rho actually mattered even at retail scale.",
    whenItLies: "Rho is the smallest Greek most of the time. Chasing it as a trade concept usually means you're overthinking a small effect.",
  },

  // ---- Volatility ------------------------------------------------------
  implied_volatility: {
    term: "Implied volatility (IV)",
    what: "The market's forecast of how much the underlying will move over the option's remaining life, extracted from the price of the option itself. Higher IV = more expensive options.",
    whyVetsWatchIt: "IV is the price of insurance. When it's rich, professionals sell it (short premium). When it's cheap, they buy it. Comparing IV to realized volatility is the fundamental vol trade.",
    whenItLies: "IV is forward-looking and priced by the crowd. A 'cheap' IV can stay cheap for months in a calm regime, and a 'rich' IV can get richer during a crisis before it reverts.",
  },
  realized_volatility: {
    term: "Realized volatility",
    what: "How much the underlying *actually* moved over some past window, annualized. The rearview mirror to IV's headlights.",
    whyVetsWatchIt: "The gap between IV and realized vol is edge. Consistently selling premium when IV > realized (and vice versa) is a real, historically-profitable strategy at professional scale.",
    whenItLies: "Realized vol tells you what happened, not what will happen. The regime that produced calm realized vol yesterday can turn on you overnight.",
  },
  iv_surface: {
    term: "IV surface",
    what: "The 2D grid of implied vols across every strike and every expiry for one underlying. Not one number — a whole landscape.",
    whyVetsWatchIt: "The shape of the surface (its skew, smile, and term structure) tells you what the market is pricing about tail risk, sentiment, and upcoming events.",
    whenItLies: "The surface is calibrated to current prices; it shifts constantly. Two 'similar-looking' surfaces can be pricing very different things about the near term.",
  },
  skew: {
    term: "Skew",
    what: "The tilt of the IV surface — in equity options, OTM puts almost always cost more than OTM calls at the same distance from spot. That asymmetry is called skew.",
    whyVetsWatchIt: "Skew exists because the market permanently prices crash risk after 1987. Steepening skew is a leading indicator of fear; flattening skew signals complacency.",
    whenItLies: "Skew can steepen for weeks without a crash actually arriving. It's a fear gauge, not a timer.",
  },
  smile: {
    term: "Smile",
    what: "The U-shape when you plot IV against strike — both wings of the surface trade richer than ATM.",
    whyVetsWatchIt: "The smile is the market's way of saying tails are fatter than a normal distribution predicts. Real markets crash and rip more often than the math would suggest.",
    whenItLies: "The smile's shape shifts with regime. Reading today's smile as if it were structural can miss short-term dislocations that matter.",
  },
  term_structure: {
    term: "Term structure",
    what: "How ATM IV changes as you go from short-dated options to long-dated ones. Usually rises with tenor in calm markets (contango) and inverts during crises (backwardation).",
    whyVetsWatchIt: "An inverted term structure — short-dated IV higher than long-dated — is one of the most reliable stress signals in the market.",
    whenItLies: "Term structure moves for scheduled events (an earnings release pushes short-dated IV up temporarily) that have nothing to do with regime.",
  },

  // ---- Flow / positioning ---------------------------------------------
  pc_ratio: {
    term: "Put/Call ratio",
    what: "Total put volume divided by total call volume over a window. Above 1 = more puts than calls. Below 1 = more calls than puts.",
    whyVetsWatchIt: "A sudden shift in the ratio tells you positioning is changing. Read alongside IV: a put-heavy shift with rising IV is fear; a call-heavy shift with rising IV is a squeeze setup.",
    whenItLies: "The ratio can be gamed by hedging flow. A big institution buying a protective put chunk isn't a bearish sentiment signal — it's insurance.",
  },
  open_interest: {
    term: "Open interest (OI)",
    what: "The number of option contracts currently outstanding at that strike/expiry. Grows when new positions open; shrinks when they close.",
    whyVetsWatchIt: "OI shows where positioning is concentrated. Strikes with heavy OI often act as pin-risk magnets into expiry.",
    whenItLies: "OI is a stock (level), not a flow (change). A high-OI strike could reflect a huge fresh bet or years of accumulated hedges — the number alone doesn't say which.",
  },
  vol_oi_ratio: {
    term: "Volume/OI",
    what: "Today's option volume divided by open interest. When it's high (e.g., >0.5), a lot of *new* positioning is opening faster than existing positions can close.",
    whyVetsWatchIt: "Vol/OI spikes precede realized-vol expansion more often than not — new positioning drives new hedging, which drives spot movement.",
    whenItLies: "Big vol/OI numbers on very illiquid strikes can be noise. Focus on liquid ATM strips where the numbers are meaningful.",
  },
  gamma_exposure: {
    term: "Gamma exposure (GEX)",
    what: "The dealer community's aggregate gamma position across all outstanding options. When dealers are 'long gamma' they buy dips and sell rallies (stabilizing); when 'short gamma' they do the opposite (destabilizing).",
    whyVetsWatchIt: "GEX-flip levels have become self-fulfilling in modern markets. Big moves often cluster around zero-gamma levels because dealer hedging reverses direction.",
    whenItLies: "GEX estimates depend on assumptions about which dealer is on which side of each option. Different vendors publish very different numbers for the same day.",
  },
  delta_hedging: {
    term: "Delta hedging",
    what: "Continuously buying or selling the underlying to keep an option position's net delta at zero. Market makers do this to isolate the vol trade from the direction trade.",
    whyVetsWatchIt: "Delta hedging is what makes market making a business rather than a bet. Understanding it explains why big options flow can move the underlying stock.",
    whenItLies: "Perfect hedging is impossible in the real world (transaction costs, gaps). What sounds neutral in theory can accumulate real P&L when markets move violently.",
  },

  // ---- Common patterns / events ---------------------------------------
  iv_crush: {
    term: "IV crush",
    what: "The sudden collapse of implied volatility after a known event resolves — earnings, FOMC, an FDA decision. Options can drop 30-50% overnight even if spot barely moved.",
    whyVetsWatchIt: "The predictable IV drop makes long-option positions into earnings a losing trade on average, and makes short-premium plays into earnings the classic vol-desk setup.",
    whenItLies: "The IV crush is real, but occasionally the news breaks bigger than expected and spot moves enough to overwhelm it. That's the tail that catches short-premium traders.",
  },
  gamma_squeeze: {
    term: "Gamma squeeze",
    what: "A feedback loop where retail buys short-dated calls, forcing dealers to buy stock to hedge, forcing spot up, forcing more call-buying. GME 2021 was the canonical example.",
    whyVetsWatchIt: "The mechanic is real and repeats — extreme call-side vol/OI divergence on a heavily-shorted name is the setup vets watch for.",
    whenItLies: "Squeezes are extreme but rare. Most cases of 'looks like the setup' don't produce a squeeze — they produce a vol-rich name that then IV-crushes.",
  },
  short_squeeze: {
    term: "Short squeeze",
    what: "When a heavily-shorted stock rises and shorts are forced to buy back to cover, pushing spot even higher in a runaway.",
    whyVetsWatchIt: "Short squeezes leave a clear options signature — inverted P/C ratios, call-side skew flattening, extreme vol/OI on OTM calls.",
    whenItLies: "'High short interest' by itself doesn't mean a squeeze is imminent — most heavily-shorted names never squeeze.",
  },

  // ---- Strategy structures --------------------------------------------
  straddle: {
    term: "Straddle",
    what: "Long one call and one put at the same strike and expiry. Wins if spot moves far in either direction; loses to time decay if it doesn't.",
    whyVetsWatchIt: "Straddles isolate the vol trade — they're roughly delta-neutral at entry, so P&L is mostly vega and gamma. The archetypal long-vol trade.",
    whenItLies: "Long straddles need a *bigger* move than the market expects to profit — you're paying premium *twice*, so the break-evens are wide.",
  },
  strangle: {
    term: "Strangle",
    what: "Similar to a straddle but with OTM strikes — long one OTM call and one OTM put. Cheaper than a straddle but needs a bigger move.",
    whyVetsWatchIt: "Short strangles are the classic income trade — collect premium on both sides in calm regimes. High capital efficiency but tail-risk brutal.",
    whenItLies: "Short strangles profit slowly and lose fast. A single tail event can erase months of collected premium.",
  },
  iron_condor: {
    term: "Iron condor",
    what: "Short a strangle, long a further-out strangle. Same idea as a naked short strangle, but the outer wings cap the max loss.",
    whyVetsWatchIt: "Iron condors let vol traders express 'IV is too high' without unlimited tail exposure. The wings are what let this be a repeatable strategy rather than a career-ender.",
    whenItLies: "The defined max loss is still large relative to the max win. Winning 60% of the time still doesn't beat the strategy if the losses are big.",
  },
  vertical_spread: {
    term: "Vertical spread",
    what: "Long one option and short another at a different strike, same expiry. A call spread expresses moderate upside with defined risk; a put spread the opposite.",
    whyVetsWatchIt: "Spreads reduce IV exposure — you're long and short vega at once. That makes them cleaner directional trades than naked long options in high-IV regimes.",
    whenItLies: "The cap on the upside is real. If you were right in the biggest move of the year, a spread caps what you earn from being right.",
  },
  covered_call: {
    term: "Covered call",
    what: "Owning 100 shares and selling one call against them. You collect premium in exchange for capping your upside above the strike.",
    whyVetsWatchIt: "The dominant income strategy for long-term stock holders. Selling monthly calls can add several percentage points of annual return in flat-to-up markets.",
    whenItLies: "In a runaway rally, you cap yourself out. In a crash, the premium you collected is far too small to offset the loss on the shares.",
  },

  // ---- Personas -------------------------------------------------------
  market_maker: {
    term: "Market maker",
    what: "A professional who quotes both a bid and an offer, providing liquidity to buyers and sellers. Profits on the spread between them; delta-hedges to stay flat on direction.",
    whyVetsWatchIt: "Market makers set the visible option prices — their inventory and hedging behavior drives a lot of the intraday tape.",
    whenItLies: "Market makers aren't neutral — they take on directional inventory constantly and hedge it out. Reading their quotes as 'the market's view' can miss the flow behind them.",
  },
  directional_trader: {
    term: "Directional trader",
    what: "A trader who takes a view on where the underlying goes next and uses options for defined-risk leverage rather than to trade vol.",
    whyVetsWatchIt: "This is what most retail options users effectively are, even if they don't call themselves that. Understanding the persona sharpens how to think about your own trades.",
    whenItLies: "Being right on direction and profiting are different things. Directional traders lose to IV crush, theta, and time all the time — direction is necessary but not sufficient.",
  },
  vol_trader: {
    term: "Vol trader",
    what: "A trader who trades implied vol itself — sells rich vol, buys cheap vol, hedges direction out via delta hedging. Cares primarily about vega and gamma.",
    whyVetsWatchIt: "Vol trading is where the largest professional edge lives. Understanding the persona explains why IV mean-reversion is the strongest and most repeatable pattern in options.",
    whenItLies: "Vol trading requires constant hedging discipline and deep capital. The strategy is robust in expectation but has ugly-shape return distributions — many small wins, occasional huge losses.",
  },

  // ---- Anomaly types (link to detector kinds) -------------------------
  iv_spike_kind: {
    term: "IV spike",
    what: "The ATM implied vol jumps multiple standard deviations above its recent rolling window — a sudden repricing of fear or uncertainty.",
    whyVetsWatchIt: "IV spikes almost always precede or accompany real information flow. The direction the underlying moves next is separate — the spike itself says 'something is changing'.",
    whenItLies: "Scheduled events (earnings, FOMC) produce predictable IV spikes that aren't really anomalies — the professional detector suppresses them; this one doesn't yet.",
  },
  pc_ratio_shift_kind: {
    term: "P/C ratio shift",
    what: "The put/call volume ratio moves multiple standard deviations from its recent baseline — either put-heavy (fear/hedging) or call-heavy (bullish/speculative).",
    whyVetsWatchIt: "Big shifts often lead the tape. Institutions position through options before their conviction shows up in spot direction.",
    whenItLies: "Hedging flow can look like a bearish shift when it's just insurance — a shift without a corresponding IV move is less informative.",
  },
  vol_oi_divergence_kind: {
    term: "Vol/OI divergence",
    what: "Today's option volume dwarfs open interest — meaning a lot of *new* positioning is being opened faster than existing positions are closing. Vets read this as informed flow.",
    whyVetsWatchIt: "Vol/OI blow-outs tend to precede spot moves within a session or two — they're one of the strongest leading indicators of near-term price action.",
    whenItLies: "Illiquid strikes with tiny OI produce huge vol/OI ratios from routine flow. The signal only carries where OI is meaningful.",
  },

  // ---- Detector / statistical concepts --------------------------------
  z_score: {
    term: "Z-score",
    what: "How many standard deviations an observation is from the recent rolling mean. |z| > 3 is roughly a 0.3% event under normal assumptions — the threshold this detector uses.",
    whyVetsWatchIt: "Rolling z-scores are the cleanest way to normalize signals across regimes — a 30% IV in a calm year is anomalous but not in a stressed one.",
    whenItLies: "Real financial returns have much fatter tails than the normal distribution. A '4-sigma' event is far more common than the math predicts.",
  },
  confidence_score: {
    term: "Confidence score",
    what: "0-100 blend of three factors: how far past the trigger the signal is (magnitude), how mature the rolling window is (sample), and a discount for stressed regimes (regime).",
    whyVetsWatchIt: "A single confidence gauge is a lie by construction — showing the components separately is how you keep the number honest.",
    whenItLies: "Even a 90-confidence signal can be wrong. Confidence is about how much the detector trusts *itself*, not about probability of profit.",
  },
  base_rate: {
    term: "Base rate",
    what: "How often a specific pattern has resolved a certain way historically. If similar setups produced positive forward returns 60% of the time, that's the base rate.",
    whyVetsWatchIt: "Professional edge is a base-rate game — win rates in the mid-50s to 60s applied consistently beat directional gut-feel trading.",
    whenItLies: "Base rates from small samples are noisy. Six historical episodes tell you almost nothing about what happens next.",
  },
};

export function getTerm(k: string): GlossaryEntry | undefined {
  return GLOSSARY[k];
}
