import { useEffect, useState } from "react";
import {
  type AsvIndex,
  type BenchmarkInfo,
  graphToPath,
  loadGraph,
  multiSeriesFromGraph,
  paramCombos,
  prettyUnit,
} from "../lib/asv";
import { EmptyState } from "./EmptyState";

type Props = {
  index: AsvIndex;
  benches: BenchmarkInfo[];
  state: Record<string, string>;
  onOpen: (name: string, paramIdx?: number) => void;
};

/** Multi-param benches: table of param combos at latest revision. */
export function SummaryGrid({ index, benches, state, onOpen }: Props) {
  const multiNames = benches
    .filter((b) => (b.params || []).length > 0)
    .map((b) => b.name)
    .join("\0");
  const multi = benches.filter((b) => (b.params || []).length > 0);
  const [rows, setRows] = useState<
    { name: string; unit: string; combos: { index: number; label: string; value: number | null }[] }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const list = benches.filter((b) => (b.params || []).length > 0);
    (async () => {
      const out: typeof rows = [];
      await Promise.all(
        list.map(async (b) => {
          try {
            const combos = paramCombos(b);
            const pts = await loadGraph(graphToPath(b.name, state));
            const multiS = multiSeriesFromGraph(pts, combos, combos.map((c) => c.index));
            const last = multiS.x.length - 1;
            out.push({
              name: b.name,
              unit: b.unit,
              combos: combos.map((c) => {
                const s = multiS.series.find((ss) => ss.index === c.index);
                const v = s && last >= 0 ? s.y[last] : null;
                return { index: c.index, label: c.label, value: v ?? null };
              }),
            });
          } catch {
            out.push({ name: b.name, unit: b.unit, combos: [] });
          }
        }),
      );
      out.sort((a, b) => a.name.localeCompare(b.name));
      if (!cancelled) {
        setRows(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // multiNames encodes the filtered bench set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiNames, state]);

  if (!multi.length) {
    return (
      <div className="main">
        <div className="page-head">
          <div>
            <h1>Summary grid</h1>
            <p>Param-combo table at the latest revision (multi-param benches only).</p>
          </div>
        </div>
        <EmptyState kind="no-benches" />
      </div>
    );
  }

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Summary grid</h1>
          <p>
            Latest-revision values for every param combo. Click a cell to open Explore with that series.
          </p>
        </div>
        <span className="chip">{multi.length} multi-param</span>
      </div>
      {loading ? (
        <p className="muted">Loading grid…</p>
      ) : (
        rows.map((row) => (
          <div key={row.name} className="card card-pad" style={{ marginBottom: "0.85rem", overflow: "auto" }}>
            <h3 className="mono" style={{ margin: "0 0 0.55rem", fontSize: "0.95rem" }}>
              <button type="button" className="linkish" onClick={() => onOpen(row.name)}>
                {row.name}
              </button>
            </h3>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Params</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {row.combos.map((c) => (
                  <tr key={c.index} onClick={() => onOpen(row.name, c.index)}>
                    <td className="mono">{c.label}</td>
                    <td className="mono">
                      {c.value != null ? prettyUnit(c.value, row.unit) : "n/a"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
