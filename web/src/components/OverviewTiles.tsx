import { useEffect, useRef, useState } from "react";
import type { BenchmarkInfo } from "../lib/asv";
import { prettyUnit, seriesStats } from "../lib/asv";
import { Sparkline } from "./Chart";

function typeChip(t: string) {
  const k = t.toLowerCase();
  if (k.includes("mem")) return "memory";
  if (k.includes("track")) return "track";
  return "time";
}

const BATCH = 24;

/**
 * Virtualized / progressive Overview tiles.
 * Sparklines load in batches of 24; tiles far from viewport skip heavy spark render until visible.
 */
export function OverviewTiles({
  benches,
  sparks,
  sparkBands,
  onOpen,
}: {
  benches: BenchmarkInfo[];
  sparks: Record<string, number[]>;
  sparkBands?: Record<string, { lo?: number | null; hi?: number | null }>;
  onOpen: (name: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const [inView, setInView] = useState<Record<string, boolean>>({});
  const sentinel = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    setVisibleCount(BATCH);
  }, [benches]);

  // progressive load more when sentinel visible
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => Math.min(benches.length, n + BATCH));
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [benches.length]);

  // per-tile visibility for spark render
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        setInView((prev) => {
          const next = { ...prev };
          for (const e of entries) {
            const name = (e.target as HTMLElement).dataset.bench;
            if (name) next[name] = e.isIntersecting;
          }
          return next;
        });
      },
      { rootMargin: "120px" },
    );
    for (const [, node] of tileRefs.current) io.observe(node);
    return () => io.disconnect();
  }, [visibleCount, benches]);

  const slice = benches.slice(0, visibleCount);

  return (
    <>
      {slice.map((b) => {
        const y = sparks[b.name] || [];
        const st = seriesStats(y);
        const delta =
          st.change == null
            ? null
            : st.change >= 0
              ? `+${(st.change * 100).toFixed(1)}%`
              : `${(st.change * 100).toFixed(1)}%`;
        const band = sparkBands?.[b.name];
        const showSpark = inView[b.name] !== false && y.length > 1;
        return (
          <div
            key={b.name}
            className="card tile fade-in"
            data-bench={b.name}
            ref={(node) => {
              if (node) tileRefs.current.set(b.name, node);
              else tileRefs.current.delete(b.name);
            }}
            onClick={() => onOpen(b.name)}
          >
            <div className="chip-row">
              <span className={`chip ${typeChip(b.type)}`}>{b.type}</span>
              <span className="chip">{b.unit}</span>
            </div>
            <div className="name">{b.name}</div>
            {showSpark ? (
              <Sparkline y={y} width={180} height={40} lo={band?.lo} hi={band?.hi} />
            ) : (
              <div className="spark" />
            )}
            <div className="foot">
              <span>{st.latest != null ? prettyUnit(st.latest, b.unit) : "—"}</span>
              {delta && (
                <span
                  className={
                    st.change! > 0.05
                      ? "delta-up"
                      : st.change! < -0.05
                        ? "delta-down"
                        : "muted"
                  }
                >
                  {delta}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {visibleCount < benches.length && (
        <div ref={sentinel} className="tile-sentinel muted" style={{ gridColumn: "span 12" }}>
          Loading more tiles… ({visibleCount}/{benches.length})
        </div>
      )}
    </>
  );
}
