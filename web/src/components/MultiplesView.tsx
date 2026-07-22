import { useEffect, useState } from "react";
import {
  type AsvIndex,
  type BenchmarkInfo,
  downsample,
  graphToPath,
  loadGraph,
  prettyUnit,
  scalarSeries,
  seriesStats,
} from "../lib/asv";
import { Sparkline } from "./Chart";
import { EmptyState } from "./EmptyState";

type Props = {
  index: AsvIndex;
  benches: BenchmarkInfo[];
  state: Record<string, string>;
  selected: string[];
  setSelected: (names: string[]) => void;
  onOpen: (name: string) => void;
};

/** Small-multiples wall: pick N benches, show sparkline grid. */
export function MultiplesView({
  benches,
  state,
  selected,
  setSelected,
  onOpen,
}: Props) {
  const [sparks, setSparks] = useState<Record<string, number[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number[]> = {};
      await Promise.all(
        selected.map(async (name) => {
          try {
            const s = scalarSeries(await loadGraph(graphToPath(name, state)));
            next[name] = downsample(s.x, s.y, 36).y;
          } catch {
            next[name] = [];
          }
        }),
      );
      if (!cancelled) setSparks(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, state]);

  function toggle(name: string) {
    if (selected.includes(name)) setSelected(selected.filter((n) => n !== name));
    else setSelected([...selected, name]);
  }

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Multiples wall</h1>
          <p>Pick benchmarks to compare as a small-multiples sparkline grid.</p>
        </div>
        <span className="chip">{selected.length} selected</span>
      </div>

      <div className="card card-pad" style={{ marginBottom: "0.9rem" }}>
        <div className="param-chips">
          {benches.map((b) => (
            <button
              key={b.name}
              type="button"
              className={"param-chip" + (selected.includes(b.name) ? " on" : "")}
              onClick={() => toggle(b.name)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {!selected.length ? (
        <EmptyState kind="generic" />
      ) : (
        <div className="bento">
          {selected.map((name) => {
            const b = benches.find((x) => x.name === name);
            const y = sparks[name] || [];
            const st = seriesStats(y);
            return (
              <div
                key={name}
                className="card tile fade-in"
                style={{ gridColumn: "span 4" }}
                onClick={() => onOpen(name)}
              >
                <div className="name">{name}</div>
                {y.length > 1 ? <Sparkline y={y} width={200} height={48} /> : <div className="spark" />}
                <div className="foot">
                  <span>
                    {st.latest != null && b
                      ? prettyUnit(st.latest, b.unit)
                      : "—"}
                  </span>
                  {st.change != null && (
                    <span className={st.change > 0.05 ? "delta-up" : st.change < -0.05 ? "delta-down" : "muted"}>
                      {(st.change * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
