import { useEffect, useRef, useState } from "react";
import { getTerm } from "@/lib/glossary";

/**
 * Inline, tap-to-expand teachable term. Wrap any jargon:
 *   <Term k="delta">delta</Term>
 * Dotted underline → click → three-part popover (what / why vets watch it /
 * when it lies to you). Mirrors Stocky's Term component so the learning
 * pattern reads the same across both apps.
 *
 * Renders a <button>, so it must never be nested inside another button. If
 * you need to attach terms to headings inside clickable rows, split the row
 * so the clickable wrapper doesn't contain a Term.
 */
export function Term({
  k,
  children,
  className = "",
}: {
  k: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = getTerm(k);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

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

  if (!entry) return <span className={className}>{children}</span>;

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`cursor-help border-b border-dotted border-copper/50 text-inherit decoration-dotted underline-offset-2 transition-colors hover:border-copper hover:text-amber ${className}`}
        aria-expanded={open}
      >
        {children ?? entry.term}
      </button>

      {open && (
        <span
          role="dialog"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full z-50 mt-2 block w-80 cursor-default rounded-lg border border-copper/25 bg-elev p-4 text-left shadow-glow"
        >
          <span className="mb-1.5 block font-display text-[15px] italic text-copper">
            {entry.term}
          </span>
          <span className="block text-xs leading-relaxed text-ink">
            {entry.what}
          </span>

          <span className="mt-3 block text-[9px] font-medium uppercase tracking-[0.14em] text-amber">
            Why veterans watch it
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {entry.whyVetsWatchIt}
          </span>

          <span className="mt-3 block text-[9px] font-medium uppercase tracking-[0.14em] text-rose">
            When it lies to you
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {entry.whenItLies}
          </span>
        </span>
      )}
    </span>
  );
}
