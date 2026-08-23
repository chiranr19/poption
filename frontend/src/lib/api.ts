// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import type { Scenario } from "./types";

const API = "/api";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export const getScenarios = () =>
  jsonFetch<{ scenarios: Scenario[] }>("/scenarios").then((r) => r.scenarios);

export const startReplay = (key: string) =>
  jsonFetch("/replay/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });

export const stopReplay = () => jsonFetch("/replay/stop", { method: "POST" });

export const setRegime = (regime: "calm" | "normal" | "stressed") =>
  jsonFetch("/control/regime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regime }) });

export const setRate = (tick_seconds: number) =>
  jsonFetch("/control/rate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tick_seconds }) });

export const getForensics = (anomalyId: string, depth: "fast" | "deep" = "fast") =>
  jsonFetch<import("./types").ForensicsResponse>(
    `/forensics/${anomalyId}/full?depth=${depth}`,
  );

/**
 * Connect the WebSocket with auto-reconnect on drop. Returns a `close()`.
 *
 * The reconnect uses a small backoff so a killed backend that restarts a few
 * seconds later reconnects without a page reload — critical for demo pacing.
 */
export function connectStream(
  onFrame: (frame: import("./types").WsFrame) => void,
  onStatus?: (s: "connecting" | "open" | "closed") => void,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let backoff = 400;

  const open = () => {
    if (closed) return;
    onStatus?.("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => {
      backoff = 400;
      onStatus?.("open");
    };
    ws.onmessage = (ev) => {
      try {
        onFrame(JSON.parse(ev.data));
      } catch {
        /* skip malformed frame; the pipeline is deterministic so this only
           happens on network glitches */
      }
    };
    ws.onclose = () => {
      onStatus?.("closed");
      if (closed) return;
      setTimeout(open, backoff);
      backoff = Math.min(6000, backoff * 1.6);
    };
    ws.onerror = () => ws?.close();
  };
  open();
  return () => {
    closed = true;
    ws?.close();
  };
}
