// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
import { useState } from "react";
import type { Anomaly, ChainSnapshot, ForensicsResponse } from "@/lib/types";
import type { StudyCard } from "@/lib/studycards";
import { ForensicsPanel } from "./ForensicsPanel";
import { HowToRead } from "./learn/HowToRead";
import { Playbook } from "./learn/Playbook";
import { PersonaTrades } from "./learn/PersonaTrades";
import { StudyCards } from "./learn/StudyCards";

type Tab = "read" | "playbook" | "personas" | "forensics" | "watching";

/**
 * The tabbed learning drawer that replaces the old single-panel drawer.
 * Same anomaly-selected trigger, more surfaces to learn from — and the
 * "Watching" tab is always available (even without a selected anomaly)
 * so the user can check on their tagged trades any time.
 */
export function LearningDrawer({
  anomaly,
  snapshot,
  forensics,
  studyCards,
  onStudyCardsChange,
  onClose,
}: {
  anomaly: Anomaly | null;
  snapshot: ChainSnapshot | null;
  forensics: ForensicsResponse | null;
  studyCards: StudyCard[];
  onStudyCardsChange: (next: StudyCard[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("read");
  const openCount = studyCards.filter((c) => c.status === "open").length;

  const tabs: { key: Tab; label: string; badge?: string; hidden?: boolean }[] = [
    { key: "read", label: "How to read", hidden: !anomaly },
    { key: "playbook", label: "Playbook", hidden: !anomaly },
    { key: "personas", label: "Persona trades", hidden: !anomaly },
    { key: "forensics", label: "Forensics", hidden: !anomaly },
    {
      key: "watching",
      label: "Watching",
      badge: studyCards.length ? String(studyCards.length) : undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-hair px-4 pb-2 pt-2 lg:px-6">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-t-md px-3 py-1.5 text-[11px] tracking-wide transition-colors ${
                tab === t.key
                  ? "border-b-2 border-copper text-ink"
                  : "border-b-2 border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.badge && (
                <span className="ml-1.5 rounded bg-copper/20 px-1 font-mono text-[9px] text-copper">
                  {openCount ? `${openCount} open` : t.badge}
                </span>
              )}
            </button>
          ))}
        {anomaly && (
          <button
            onClick={onClose}
            className="ml-auto rounded-md border border-hair px-3 py-1 text-[10px] uppercase tracking-wider text-muted hover:border-rose/40 hover:text-rose"
          >
            Close
          </button>
        )}
      </div>

      <div className="px-4 py-4 lg:px-6">
        {tab === "read" && anomaly && (
          <div className="mx-auto max-w-3xl">
            <HowToRead kind={anomaly.kind} />
          </div>
        )}
        {tab === "playbook" && anomaly && <Playbook kind={anomaly.kind} />}
        {tab === "personas" && anomaly && (
          <PersonaTrades
            anomaly={anomaly}
            snapshot={snapshot}
            onCardCreated={(card) => onStudyCardsChange([card, ...studyCards])}
          />
        )}
        {tab === "forensics" && anomaly && (
          <ForensicsPanel
            anomaly={anomaly}
            forensics={forensics}
            onClose={onClose}
          />
        )}
        {tab === "watching" && (
          <StudyCards
            cards={studyCards}
            snapshot={snapshot}
            onChange={onStudyCardsChange}
          />
        )}
      </div>
    </div>
  );
}
