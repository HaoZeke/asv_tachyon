import { useEffect, useMemo, useState } from "react";
import {
  type AsvIndex,
  type BenchmarkInfo,
  commitHash,
  graphToPath,
  isHigherBetter,
  loadGraph,
  ratioHeatColor,
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


  if (!benches.length) return <EmptyState kind="no-benches" />;

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>What regressed</h1>
          <p>
            Heatmap of value ratio vs the previous measured revision (last {lastN}).
            Color respects higher-is-better. Click a row to open Explore.
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
                const hib = isHigherBetter(b);
                return (
                  <tr key={b.name} onClick={() => onOpen(b.name)} className="heatmap-row">
                    <td className="mono">{b.name}</td>
                    {revs.map((r, i) => {
                      const cur = row[r];
                      // Walk back to last measured datapoint (not empty column)
                      let prev: number | null = null;
                      for (let j = i - 1; j >= 0; j--) {
                        const v = row[revs[j]];
                        if (v != null) {
                          prev = v;
                          break;
                        }
                      }
                      const ratio =
                        cur != null && prev != null && prev !== 0 ? cur / prev : null;
                      return (
                        <td
                          key={r}
                          style={{ background: ratioHeatColor(ratio, hib) }}
                          title={
                            ratio != null
                              ? `${b.name} @ ${r}: ${ratio.toFixed(3)}x vs prev measured`
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
