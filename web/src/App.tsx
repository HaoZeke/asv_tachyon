import { useEffect, useMemo, useState } from "react";
import {
  AsvIndex,
  BenchmarkInfo,
  commitHash,
  defaultState,
  downsample,
  graphToPath,
  loadGraph,
  loadIndex,
  prettyUnit,
  scalarSeries,
  seriesStats,
} from "./lib/asv";
import { Chart, Sparkline } from "./components/Chart";

type View = "overview" | "explore" | "compare";

function typeChip(t: string) {
  const k = t.toLowerCase();
  if (k.includes("mem")) return "memory";
  if (k.includes("track")) return "track";
  return "time";
}

function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  return (
    <button className="icon-btn" onClick={onToggle} title="Toggle light/dark" aria-label="Toggle theme">
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export default function App() {
  const [index, setIndex] = useState<AsvIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, string>>({});
  const [series, setSeries] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("asv-tachyon-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("asv-tachyon-theme", theme);
  }, [theme]);

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
    if (!index) return [] as BenchmarkInfo[];
    const q = query.trim().toLowerCase();
    return Object.values(index.benchmarks)
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index, query]);

  useEffect(() => {
    if (!index || !Object.keys(state).length) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, number[]> = {};
      await Promise.all(
        Object.keys(index.benchmarks).map(async (name) => {
          try {
            const pts = await loadGraph(graphToPath(name, state));
            const s = scalarSeries(pts);
            next[name] = downsample(s.x, s.y, 28).y;
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
  }, [index, state]);

  useEffect(() => {
    if (!index || !selected) return;
    setLoadingGraph(true);
    loadGraph(graphToPath(selected, state))
      .then((pts) => setSeries(scalarSeries(pts)))
      .catch(() => setSeries({ x: [], y: [] }))
      .finally(() => setLoadingGraph(false));
  }, [index, selected, state]);

  function openBench(name: string) {
    setSelected(name);
    setView("explore");
  }

  if (error) {
    return (
      <div className="main">
        <div className="error">
          <strong>Could not load ASV data.</strong>
          <p>{error}</p>
          <p className="muted">
            Run <code>asv publish</code>, then <code>asv-tachyon serve .asv/html</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!index) {
    return (
      <div className="main">
        <div className="loading muted">Loading benchmark atlas…</div>
      </div>
    );
  }

  const bench = selected ? index.benchmarks[selected] : null;
  const stats = seriesStats(series.y);
  const unit = bench?.unit || "seconds";
  const nCommits = Object.keys(index.revision_to_hash).length;
  const compareRows = benches.map((b) => ({ b, st: seriesStats(sparks[b.name] || []) }));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">τ</div>
          <div className="brand-text">
            <strong>asv tachyon</strong>
            <span>
              <a href={index.project_url || "#"} target="_blank" rel="noreferrer">
                {index.project}
              </a>
            </span>
          </div>
        </div>

        <div className="seg" role="tablist">
          <button type="button" className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            Overview
          </button>
          <button type="button" className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>
            Explore
          </button>
          <button type="button" className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>
            Compare
          </button>
        </div>

        <div className="search-wrap">
          <SearchIcon />
          <input
            className="search"
            placeholder="Search benchmarks, types…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="top-actions">
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
        </div>
      </header>

      {view === "overview" && (
        <div className="main">
          <div className="page-head">
            <div>
              <h1>Performance atlas</h1>
              <p>Fluid browser over <code>asv publish</code> data — same graphs, new skin.</p>
            </div>
            <div className="chip-row">
              <span className="chip">{benches.length} benchmarks</span>
              <span className="chip">{nCommits} revisions</span>
              <span className="chip">{Object.keys(index.params).length} selectors</span>
            </div>
          </div>

          <div className="filters">
            {Object.entries(index.params).map(([key, values]) => (
              <label className="filter" key={key}>
                <span>{key}</span>
                <select
                  value={state[key] ?? values[0] ?? ""}
                  onChange={(e) => setState((s) => ({ ...s, [key]: e.target.value }))}
                >
                  {values.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="bento">
            <div className="card hero">
              <div>
                <h2>Watch the curves, not the chrome</h2>
                <p>
                  Overview tiles stream sparklines from the published graph tree. Explore for full
                  charts and source. Light and dark themes stick to your preference.
                </p>
              </div>
              <div className="kpi-row">
                <div className="kpi"><div className="k">Project</div><div className="v" style={{ fontSize: "1rem" }}>{index.project}</div></div>
                <div className="kpi"><div className="k">Tags</div><div className="v">{Object.keys(index.tags || {}).length}</div></div>
                <div className="kpi"><div className="k">Machines</div><div className="v">{Object.keys(index.machines || {}).length}</div></div>
              </div>
            </div>

            {benches.map((b) => {
              const y = sparks[b.name] || [];
              const st = seriesStats(y);
              const delta = st.change == null ? null : st.change >= 0 ? `+${(st.change * 100).toFixed(1)}%` : `${(st.change * 100).toFixed(1)}%`;
              return (
                <div key={b.name} className="card tile" onClick={() => openBench(b.name)}>
                  <div className="chip-row">
                    <span className={`chip ${typeChip(b.type)}`}>{b.type}</span>
                    <span className="chip">{b.unit}</span>
                  </div>
                  <div className="name">{b.name}</div>
                  {y.length > 1 ? <Sparkline y={y} width={180} height={40} /> : <div className="spark" />}
                  <div className="foot">
                    <span>{st.latest != null ? prettyUnit(st.latest, b.unit) : "—"}</span>
                    {delta && (
                      <span className={st.change! > 0.05 ? "delta-up" : st.change! < -0.05 ? "delta-down" : "muted"}>
                        {delta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "explore" && (
        <div className="shell">
          <aside className="sidebar">
            <h3 style={{ margin: "0 0 0.75rem", color: "var(--text-faint)", fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Library
            </h3>
            <div className="bench-list">
              {benches.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className={"bench-item" + (selected === b.name ? " active" : "")}
                  onClick={() => openBench(b.name)}
                >
                  <div className="name">{b.name}</div>
                  <div className="meta">{b.type} · {b.unit}</div>
                </button>
              ))}
            </div>
          </aside>
          <main className="main">
            {!bench && <div className="empty muted">Pick a benchmark to open the full chart.</div>}
            {bench && (
              <>
                <div className="page-head">
                  <div>
                    <h1 className="mono" style={{ fontSize: "1.25rem" }}>{bench.name}</h1>
                    <p>
                      <span className={`chip ${typeChip(bench.type)}`}>{bench.type}</span>{" "}
                      <span className="chip">{bench.unit}</span>
                    </p>
                  </div>
                </div>
                <div className="filters">
                  {Object.entries(index.params).map(([key, values]) => (
                    <label className="filter" key={key}>
                      <span>{key}</span>
                      <select
                        value={state[key] ?? values[0] ?? ""}
                        onChange={(e) => setState((s) => ({ ...s, [key]: e.target.value }))}
                      >
                        {values.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="stat-grid">
                  <div className="stat"><div className="k">Latest</div><div className="v">{stats.latest != null ? prettyUnit(stats.latest, unit) : "—"}</div></div>
                  <div className="stat"><div className="k">Min</div><div className="v">{stats.min != null ? prettyUnit(stats.min, unit) : "—"}</div></div>
                  <div className="stat"><div className="k">Max</div><div className="v">{stats.max != null ? prettyUnit(stats.max, unit) : "—"}</div></div>
                  <div className="stat"><div className="k">Δ first→last</div><div className={"v " + (stats.change != null && stats.change > 0.05 ? "delta-up" : stats.change != null && stats.change < -0.05 ? "delta-down" : "")}>{stats.change != null ? `${(stats.change * 100).toFixed(1)}%` : "—"}</div></div>
                </div>
                <div className="detail-grid">
                  <div className="card chart-card">
                    {loadingGraph ? <p className="muted">Loading graph…</p> : <Chart x={series.x} y={series.y} unit={unit} />}
                    {series.x.length > 0 && (
                      <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.82rem" }}>
                        last <code>{commitHash(index, series.x[series.x.length - 1])}</code>
                        {index.show_commit_url && (
                          <> · <a href={index.show_commit_url + commitHash(index, series.x[series.x.length - 1])} target="_blank" rel="noreferrer">open commit</a></>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="side-panel">
                    <div className="card card-pad">
                      <h3>Recent points</h3>
                      <div className="point-list">
                        {series.x.slice(-8).reverse().map((rev, i) => (
                          <div className="point-row" key={rev}>
                            <code>{commitHash(index, rev)}</code>
                            <span className="mono">{prettyUnit(series.y[series.y.length - 1 - i], unit)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {bench.code && (
                      <div className="card card-pad source">
                        <h3>Source</h3>
                        <pre>{bench.code}</pre>
                      </div>
                    )}
                    <div className="card card-pad">
                      <h3>Environment</h3>
                      <div className="chip-row">
                        {Object.entries(state).map(([k, v]) => (
                          <span className="chip" key={k}>{k}: {v}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {view === "compare" && (
        <div className="main">
          <div className="page-head">
            <div>
              <h1>Compare snapshot</h1>
              <p>First vs last revision under the current selectors — click a row to explore.</p>
            </div>
          </div>
          <div className="filters">
            {Object.entries(index.params).map(([key, values]) => (
              <label className="filter" key={key}>
                <span>{key}</span>
                <select
                  value={state[key] ?? values[0] ?? ""}
                  onChange={(e) => setState((s) => ({ ...s, [key]: e.target.value }))}
                >
                  {values.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="card card-pad" style={{ overflow: "auto" }}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Benchmark</th>
                  <th>Type</th>
                  <th>First</th>
                  <th>Latest</th>
                  <th>Δ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map(({ b, st }) => {
                  const y = sparks[b.name] || [];
                  const first = y.length ? y[0] : null;
                  const delta = st.change;
                  return (
                    <tr key={b.name} onClick={() => openBench(b.name)}>
                      <td className="mono">{b.name}</td>
                      <td><span className={`chip ${typeChip(b.type)}`}>{b.type}</span></td>
                      <td className="mono">{first != null ? prettyUnit(first, b.unit) : "—"}</td>
                      <td className="mono">{st.latest != null ? prettyUnit(st.latest, b.unit) : "—"}</td>
                      <td className={delta != null && delta > 0.05 ? "delta-up" : delta != null && delta < -0.05 ? "delta-down" : "muted"}>
                        {delta != null ? `${(delta * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td>{y.length > 1 ? <Sparkline y={y} width={90} height={28} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
