// Mirrors backend/app/models.py — keep in sync when changing shapes.

export type Regime = "calm" | "normal" | "stressed";
export type AnomalyKind = "iv_spike" | "pc_ratio_shift" | "vol_oi_divergence";

export interface OptionQuote {
  strike: number;
  dte_days: number;
  type: "call" | "put";
  bid: number;
  ask: number;
  mid: number;
  iv: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  volume: number;
  open_interest: number;
}

export interface ChainSnapshot {
  symbol: string;
  ts: number;
  spot: number;
  regime: Regime;
  quotes: OptionQuote[];
}

export interface ConfidenceFactors {
  magnitude: number;
  sample: number;
  regime: number;
}

export interface Anomaly {
  id: string;
  ts: number;
  symbol: string;
  kind: AnomalyKind;
  headline: string;
  z_score: number;
  observed: number;
  baseline_mean: number;
  baseline_std: number;
  confidence: number;
  factors: ConfidenceFactors;
  context: Record<string, unknown>;
}

export interface WsFrame {
  snapshot: ChainSnapshot;
  anomalies: Anomaly[];
}

export interface Analogue {
  id: string;
  title: string;
  date: string;
  lesson: string;
  score: number;
  tags: string[];
}

export interface ForensicsResponse {
  anomaly_id: string;
  text: string;
  analogues: Analogue[];
  grounding: {
    ok: boolean;
    unknown_numbers: string[];
    advice_hits: string[];
  };
}

export interface Scenario {
  key: string;
  title: string;
  date: string;
  summary: string;
  total_ticks: number;
}
