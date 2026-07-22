import { useEffect, useMemo, useState } from "react";
import {
  type AsvIndex,
  type BenchmarkInfo,
  commitHash,
  graphToPath,
  loadGraph,
  scalarSeries,
} from "../lib/asv";
import { EmptyState } from "./EmptyState";

type Props = {
  index: AsvIndex;
  benches: BenchmarkInfo[];
  state: Record<string, string>;
  lastN?: number;
  onOpen: (name: string) => void;
};

/** Rows = benches, cols = last N revisions, color by ratio vs previous. */
export function HeatmapView({ index, benches, state, lastN = 12, onOpen }: Props) {
  const revs = useMemo(() => {
    return Object.keys(index.revision_to_hash)
      .map(Number)
      .sort((a, b) => a - b)
      .slice(-lastN);
  }, [index, lastN]);

  const [matrix, setMatrix] = useState<Record<string, Record<number, number | null>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const next: Record<string, Record<number, number | null>> = {};
      await Promise.all(
        benches.map(async (b) => {
          try {
            const s = scalarSeries(await loadGraph(graphToPath(b.name, state)));
            const map = new Map(s.x.map((x, i) => [x, s.y[i]]));
            next[b.name] = {};
            for (const r of revs) next[b.name][r] = map.get(r) ?? null;
          } catch {
            next[b.name] = {};
            for (const r of revs) next[b.name][r] = null;
          }
        }),
      );
      if (!cancelled) {
        setMatrix(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [benches, state, revs]);

  function ratioColor(ratio: number | null): string {
    if (ratio == null || !Number.isFinite(ratio)) return "transparent";
    // ratio > 1 = slower (red), < 1 = faster (green)
    if (ratio >= 1.2) return "color-mix(in oklab, var(--danger) 55%, transparent)";
    if (ratio >= 1.05) return "color-mix(in oklab, var(--danger) 28%, transparent)";
    if (ratio <= 0.8) return "color-mix(in oklab, var(--ok) 55%, transparent)";
    if (ratio <= 0.95) return "color-mix(in oklab, var(--ok) 28%, transparent)";
    return "color-mix(in oklab, var(--text-faint) 8%, transparent)";
  }

  if (!benches.length) return <EmptyState kind="no-benches" />;

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>What regressed</h1>
          <p>
            Heatmap of value ratio vs the previous revision (last {lastN}). Red = slower,
            green = faster. Click a row to open Explore.
          </p>
        </div>
      </div>
      {loading ? (
        <p className="muted">Loading heatmap…</p>
      ) : (
        <div className="card card-pad heatmap-wrap">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th>Benchmark</th>
                {revs.map((r) => (
                  <th key={r} title={`rev ${r}`}>
                    {commitHash(index, r)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benches.map((b) => {
                const row = matrix[b.name] || {};
                return (
                  <tr key={b.name} onClick={() => onOpen(b.name)} className="heatmap-row">
                    <td className="mono">{b.name}</td>
                    {revs.map((r, i) => {
                      const cur = row[r];
                      const prevRev = i > 0 ? revs[i - 1] : null;
                      const prev = prevRev != null ? row[prevRev] : null;
                      const ratio =
                        cur != null && prev != null && prev !== 0 ? cur / prev : null;
                      return (
                        <td
                          key={r}
                          style={{ background: ratioColor(ratio) }}
                          title={
                            ratio != null
                              ? `${b.name} @ ${r}: ${ratio.toFixed(3)}× vs prev`
                              : `${b.name} @ ${r}: n/a`
                          }
                        >
                          {ratio != null ? ratio.toFixed(2) : "·"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
