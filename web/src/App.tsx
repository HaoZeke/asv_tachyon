import { useEffect, useMemo, useState } from "react";
import {
  AsvIndex,
  commitHash,
  defaultState,
  graphToPath,
  loadGraph,
  loadIndex,
  prettyUnit,
  scalarSeries,
  seriesStats,
} from "./lib/asv";
import { Chart } from "./components/Chart";

type View = "grid" | "list" | "detail";

export default function App() {
  const [index, setIndex] = useState<AsvIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, string>>({});
  const [series, setSeries] = useState<{ x: number[]; y: number[] }>({
    x: [],
    y: [],
  });
  const [loadingGraph, setLoadingGraph] = useState(false);

  useEffect(() => {
    loadIndex()
      .then((idx) => {
        setIndex(idx);
        setState(defaultState(idx));
        document.title = `${idx.project} · asv tachyon`;
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const benches = useMemo(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    return Object.values(index.benchmarks)
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index, query]);

  useEffect(() => {
    if (!index || !selected) return;
    const path = graphToPath(selected, state);
    setLoadingGraph(true);
    loadGraph(path)
      .then((pts) => setSeries(scalarSeries(pts)))
      .catch(() => setSeries({ x: [], y: [] }))
      .finally(() => setLoadingGraph(false));
  }, [index, selected, state]);

  function openBench(name: string) {
    setSelected(name);
    setView("detail");
  }

  if (error) {
    return (
      <div className="main">
        <div className="error">
          <strong>Could not load ASV data.</strong>
          <p>{error}</p>
          <p className="muted">
            Run <code>asv publish</code>, then{" "}
            <code>asv-tachyon serve .asv/html</code> (or open a directory that
            contains <code>index.json</code> and <code>graphs/</code>).
          </p>
        </div>
      </div>
    );
  }

  if (!index) {
    return (
      <div className="main">
        <p className="muted">Loading index.json…</p>
      </div>
    );
  }

  const bench = selected ? index.benchmarks[selected] : null;
  const stats = seriesStats(series.y);
  const unit = bench?.unit || "seconds";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span>
            <mark>asv</mark> tachyon
          </span>
          <small>
            <a href={index.project_url || "#"} target="_blank" rel="noreferrer">
              {index.project}
            </a>
          </small>
        </div>
        <nav>
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            className={view === "list" || view === "detail" ? "active" : ""}
            onClick={() => setView(selected ? "detail" : "list")}
          >
            Benchmarks
          </button>
        </nav>
        <input
          className="search"
          placeholder="Filter benchmarks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      {view === "grid" && (
        <div className="main">
          <h1>Benchmarks</h1>
          <p className="muted" style={{ marginTop: "-0.5rem" }}>
            {benches.length} suites · modern viewer for{" "}
            <code>asv publish</code> output
          </p>
          <div className="grid" style={{ marginTop: "1rem" }}>
            {benches.map((b) => (
              <div
                key={b.name}
                className="card tile"
                onClick={() => openBench(b.name)}
              >
                <div className="name">{b.name}</div>
                <div className="meta">
                  {b.type} · {b.unit}
                  {b.param_names?.length
                    ? ` · params: ${b.param_names.join(", ")}`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(view === "list" || view === "detail") && (
        <div className="layout">
          <aside className="sidebar">
            <h2>All benchmarks</h2>
            <div className="bench-list">
              {benches.map((b) => (
                <button
                  key={b.name}
                  className={
                    "bench-item" + (selected === b.name ? " active" : "")
                  }
                  onClick={() => openBench(b.name)}
                >
                  <div className="name">{b.name}</div>
                  <div className="meta">
                    {b.type} · {b.unit}
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <main className="main">
            {!bench && (
              <p className="muted">Select a benchmark from the list.</p>
            )}
            {bench && (
              <>
                <h1>{bench.name}</h1>
                <div className="filters">
                  {Object.entries(index.params).map(([key, values]) => (
                    <label key={key}>
                      {key}
                      <select
                        value={state[key] ?? values[0] ?? ""}
                        onChange={(e) =>
                          setState((s) => ({ ...s, [key]: e.target.value }))
                        }
                      >
                        {values.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="stats">
                  <div className="stat">
                    <div className="k">Latest</div>
                    <div className="v">
                      {stats.latest != null
                        ? prettyUnit(stats.latest, unit)
                        : "—"}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="k">Min</div>
                    <div className="v">
                      {stats.min != null ? prettyUnit(stats.min, unit) : "—"}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="k">Max</div>
                    <div className="v">
                      {stats.max != null ? prettyUnit(stats.max, unit) : "—"}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="k">Δ first→last</div>
                    <div className="v">
                      {stats.change != null
                        ? `${(stats.change * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                </div>

                <div className="card">
                  {loadingGraph ? (
                    <p className="muted">Loading graph…</p>
                  ) : (
                    <Chart x={series.x} y={series.y} unit={unit} />
                  )}
                  {series.x.length > 0 && (
                    <p className="muted" style={{ marginTop: "0.75rem" }}>
                      x = revision · last commit{" "}
                      <code>
                        {commitHash(index, series.x[series.x.length - 1])}
                      </code>
                      {index.show_commit_url && (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href={
                              index.show_commit_url +
                              commitHash(
                                index,
                                series.x[series.x.length - 1],
                              )
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            view
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>

                {bench.code && (
                  <div className="card" style={{ marginTop: "1rem" }}>
                    <h2>Source</h2>
                    <pre
                      style={{
                        margin: 0,
                        overflow: "auto",
                        fontFamily: "var(--mono)",
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                      }}
                    >
                      {bench.code}
                    </pre>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
