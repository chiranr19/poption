// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { connectStream, getForensics, getScenarios, startReplay, stopReplay } from "@/lib/api";
import type { Anomaly, ChainSnapshot, ForensicsResponse, Scenario, WsFrame } from "@/lib/types";
import { loadCards, type StudyCard } from "@/lib/studycards";
import { TopBar } from "@/components/TopBar";
import { PriceChart } from "@/components/PriceChart";
import { IVHeatmap } from "@/components/IVHeatmap";
import { AnomalyFeed } from "@/components/AnomalyFeed";
import { LearningDrawer } from "@/components/LearningDrawer";
import { ScenarioBar } from "@/components/ScenarioBar";
import { StartHere } from "@/components/learn/StartHere";
import { PnLMechanics } from "@/components/learn/PnLMechanics";

const ANOMALY_HISTORY_MAX = 40;

export default function App() {
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [snapshot, setSnapshot] = useState<ChainSnapshot | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ ts: number; spot: number }[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selected, setSelected] = useState<Anomaly | null>(null);
  const [forensics, setForensics] = useState<ForensicsResponse | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [studyCards, setStudyCards] = useState<StudyCard[]>([]);
  const anomalyIds = useRef<Set<string>>(new Set());

  // Bootstrap: scenarios + WebSocket + persisted study cards.
  useEffect(() => {
    setStudyCards(loadCards());
    getScenarios().then(setScenarios).catch(() => {});
    const close = connectStream(
      (frame: WsFrame) => {
        setSnapshot(frame.snapshot);
        setPriceHistory((h) => {
          const next = [...h, { ts: frame.snapshot.ts, spot: frame.snapshot.spot }];
          return next.length > 240 ? next.slice(-240) : next;
        });
        if (frame.anomalies?.length) {
          setAnomalies((prev) => {
            const fresh = frame.anomalies.filter((a) => !anomalyIds.current.has(a.id));
            fresh.forEach((a) => anomalyIds.current.add(a.id));
            const combined = [...fresh, ...prev].slice(0, ANOMALY_HISTORY_MAX);
            return combined;
          });
          setSelected(frame.anomalies[0]);
        }
      },
      setStatus,
    );
    return close;
  }, []);

  // Fetch forensics whenever a new anomaly is selected.
  useEffect(() => {
    if (!selected) {
      setForensics(null);
      return;
    }
    let alive = true;
    setForensics(null);
    getForensics(selected.id, "fast")
      .then((r) => alive && setForensics(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selected]);

  const scenarioTitle = useMemo(
    () => scenarios.find((s) => s.key === activeScenario)?.title ?? null,
    [activeScenario, scenarios],
  );
  const openWatchingCount = useMemo(
    () => studyCards.filter((c) => c.status === "open").length,
    [studyCards],
  );

  const handleStartScenario = async (key: string) => {
    setAnomalies([]);
    setSelected(null);
    anomalyIds.current.clear();
    await startReplay(key);
    setActiveScenario(key);
  };
  const handleStopScenario = async () => {
    await stopReplay();
    setActiveScenario(null);
  };

  // The drawer stays available whenever there's a selection OR there are
  // study cards to review — so the user can check on their tagged trades
  // anytime, not only right after a fire.
  const drawerOpen = selected != null || studyCards.length > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col">
      <TopBar snapshot={snapshot} status={status} openWatching={openWatchingCount} />
      <StartHere />
      <ScenarioBar
        scenarios={scenarios}
        active={activeScenario}
        activeTitle={scenarioTitle}
        onStart={handleStartScenario}
        onStop={handleStopScenario}
      />

      {/* Main grid */}
      <div className="grid flex-1 grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PriceChart history={priceHistory} snapshot={snapshot} />
          <IVHeatmap snapshot={snapshot} />
          <PnLMechanics />
        </div>
        <AnomalyFeed
          anomalies={anomalies}
          selectedId={selected?.id}
          onSelect={setSelected}
        />
      </div>

      {/* Learning drawer: tabs for how-to-read, playbook, persona trades,
          forensics, plus a persistent Watching tab that stays open even
          when no anomaly is selected. */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="border-t border-hair bg-panel/95 backdrop-blur-md"
          >
            <LearningDrawer
              anomaly={selected}
              snapshot={snapshot}
              forensics={forensics}
              studyCards={studyCards}
              onStudyCardsChange={setStudyCards}
              onClose={() => setSelected(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-hair px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-faint lg:px-6">
        Synthetic-data demo · Poption · Analysis-only · Not financial advice
      </footer>
    </div>
  );
}
