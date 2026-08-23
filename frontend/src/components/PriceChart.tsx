// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import { useEffect, useRef } from "react";
import {
  createChart,
  LineStyle,
  type ISeriesApi,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChainSnapshot } from "@/lib/types";

/**
 * Spot line + a subtle band shaded to the current regime. lightweight-charts
 * because Recharts renders a live-streaming line at 60fps only with lots of
 * memoization; lightweight-charts does it out of the box.
 */
export function PriceChart({
  history,
  snapshot,
}: {
  history: { ts: number; spot: number }[];
  snapshot: ChainSnapshot | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);

  // One-time chart creation.
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#8a8578",
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(242,238,226,0.04)" },
        horzLines: { color: "rgba(242,238,226,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(242,238,226,0.10)" },
      timeScale: {
        borderColor: "rgba(242,238,226,0.10)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(201,111,52,0.4)", style: LineStyle.Dotted, width: 1 },
        horzLine: { color: "rgba(201,111,52,0.4)", style: LineStyle.Dotted, width: 1 },
      },
      autoSize: true,
    });
    // Filled area behind the line — atmosphere, not chart-junk.
    const area = chart.addAreaSeries({
      topColor: "rgba(201, 111, 52, 0.22)",
      bottomColor: "rgba(201, 111, 52, 0.00)",
      lineColor: "rgba(201, 111, 52, 0)",
      priceLineVisible: false,
    });
    const line = chart.addLineSeries({
      color: "#c96f34",
      lineWidth: 2,
      priceLineColor: "#e6a352",
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dotted,
    });
    chartRef.current = chart;
    seriesRef.current = line;
    areaRef.current = area;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      areaRef.current = null;
    };
  }, []);

  // Feed data.
  useEffect(() => {
    const line = seriesRef.current;
    const area = areaRef.current;
    if (!line || !area || history.length === 0) return;
    const points = history.map((p) => ({
      time: Math.floor(p.ts) as UTCTimestamp,
      value: p.spot,
    }));
    line.setData(points);
    area.setData(points);
  }, [history]);

  return (
    <div className="rounded-lg border border-hair bg-panel/50 shadow-inset">
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h2 className="rule-caret font-display text-xl leading-none">Spot</h2>
        <span className="text-[10px] uppercase tracking-[0.18em] text-faint">
          {snapshot ? `regime: ${snapshot.regime}` : ""}
        </span>
      </div>
      <div ref={container} className="h-64 w-full" />
    </div>
  );
}
