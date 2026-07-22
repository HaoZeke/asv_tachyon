import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_VIEWS,
  AsvIndex,
  BenchmarkInfo,
  EnvColumn,
  MultiEnvRow,
  NamedSeries,
  PairRow,
  RegressionEntry,
  RichSeries,
  alignDualSeries,
  buildMultiEnvRows,
  buildPairRows,
  commitHash,
  defaultState,
  downsample,
  formatHash,
  fullCommitHash,
  graphParamStates,
  graphToPath,
  deltaClass,
  isHigherBetter,
  loadGraph,
  loadIndex,
  loadRegressions,
  multiSeriesFromGraph,
  paramCombos,
  parseHash,
  parseRegressions,
  prettyUnit,
  richSeries,
  scalarSeries,
  seriesColor,
  seriesStats,
  tagMarkers,
  valueAtRevision,
  type AppView,
} from "./lib/asv";
import { commitMessage, loadCommits, loadProfiles, loadSiblingSamples, profilePath, type CommitsMap, type ProfilesFile } from "./lib/sidecars";
import {
  loadMuteList,
  loadPublishedMuteList,
  mergeMuteLists,
  saveMuteList,
  toggleMute,
} from "./lib/mute";
import {
  Chart,
  TAG_DISPLAY_MODES,
  type TagDisplayMode,
} from "./components/Chart";
import { InventoryView } from "./components/InventoryView";
import { RegressionsView } from "./components/RegressionsView";
import { DistributionPanel } from "./components/DistributionPanel";
import { HeatmapView } from "./components/HeatmapView";
import { SummaryGrid } from "./components/SummaryGrid";
import { MultiplesView } from "./components/MultiplesView";
import { ReportSubview } from "./components/ReportSubview";
import { FilterChips, filterBenchesByType } from "./components/FilterChips";
import { OverviewTiles } from "./components/OverviewTiles";
import { CopyDeepLinkButton, EmptyState, PrintButton } from "./components/EmptyState";
import { CodeBlock } from "./components/CodeBlock";

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

function PairOverlay({
  name,
  stateA,
  stateB,
  unit,
  labelA,
  labelB,
}: {
  name: string;
  stateA: Record<string, string>;
  stateB: Record<string, string>;
  unit: string;
  labelA: string;
  labelB: string;
}) {
  const [data, setData] = useState<{ x: number[]; yA: number[]; yB: (number | null)[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = scalarSeries(await loadGraph(graphToPath(name, stateA)));
        const b = scalarSeries(await loadGraph(graphToPath(name, stateB)));
        const aligned = alignDualSeries(a, b);
        if (!cancelled)
          setData({
            x: aligned.x,
            yA: aligned.yA.map((v) => v ?? NaN),
            yB: aligned.yB,
          });
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, stateA, stateB]);
  if (!data) return <p className="muted">Loading overlay…</p>;
  return (
    <Chart
      x={data.x}
      y={data.yA}
      y2={data.yB}
      unit={unit}
      labelA={labelA}
      labelB={labelB}
    />
  );
}

function stateFromGraphParam(gp: Record<string, string | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(gp)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}

export default function App() {
  const [index, setIndex] = useState<AsvIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<AppView>("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, string>>({});
  const [series, setSeries] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [rich, setRich] = useState<RichSeries | null>(null);
  const [multiSeries, setMultiSeries] = useState<{ x: number[]; series: NamedSeries[] }>({
    x: [],
    series: [],
  });
  const [paramSel, setParamSel] = useState<number[] | null>(null);
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [sparkBands, setSparkBands] = useState<Record<string, { lo?: number | null; hi?: number | null }>>({});
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [pairMode, setPairMode] = useState<"env" | "revision">("env");
  const [stateA, setStateA] = useState<Record<string, string>>({});
  const [stateB, setStateB] = useState<Record<string, string>>({});
  const [envSel, setEnvSel] = useState<number[]>([0, 1]);
  const [revA, setRevA] = useState<number | null>(null);
  const [revB, setRevB] = useState<number | null>(null);
  const [factor, setFactor] = useState(1.1);
  const [regFactor, setRegFactor] = useState(1.05);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [sortPair, setSortPair] = useState<"default" | "ratio" | "name">("ratio");
  const [pairValsA, setPairValsA] = useState<Record<string, number | null>>({});
  const [pairValsB, setPairValsB] = useState<Record<string, number | null>>({});
  const [multiEnvVals, setMultiEnvVals] = useState<Record<string, number | null>[]>([]);
  const [pairLoading, setPairLoading] = useState(false);
  const [regressions, setRegressions] = useState<RegressionEntry[]>([]);
  const [regMissing, setRegMissing] = useState(false);
  const [hashReady, setHashReady] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("asv-tachyon-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [onlyRegressed, setOnlyRegressed] = useState(false);
  const [machineOverlay, setMachineOverlay] = useState<string[]>([]);
  const [machineSeries, setMachineSeries] = useState<{ x: number[]; series: NamedSeries[] } | null>(null);
  const [commits, setCommits] = useState<CommitsMap | null>(null);
  const [profiles, setProfiles] = useState<ProfilesFile | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [exploreSub, setExploreSub] = useState<"chart" | "report">("chart");
  const [muteList, setMuteList] = useState<string[]>(() => loadMuteList());
  const [showMuted, setShowMuted] = useState(false);
  const [tagMode, setTagMode] = useState<TagDisplayMode>(() => {
    const s = localStorage.getItem("asv-tachyon-tag-mode");
    if (s && TAG_DISPLAY_MODES.some((m) => m.id === s)) return s as TagDisplayMode;
    return "auto";
  });
  const [multiplesSel, setMultiplesSel] = useState<string[]>([]);
  const [regressedNames, setRegressedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("asv-tachyon-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("asv-tachyon-tag-mode", tagMode);
  }, [tagMode]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idx = await loadIndex();
        if (cancelled) return;
        setIndex(idx);
        const d = defaultState(idx);
        const hash = parseHash();
        const filters = { ...d, ...(hash.filters || {}) };
        const clean: Record<string, string> = {};
        for (const k of Object.keys(idx.params || {})) {
          clean[k] = filters[k] ?? d[k] ?? (idx.params[k]?.[0] ?? "");
        }
        setState(clean);
        setStateA(clean);
        const envs = graphParamStates(idx);
        if (hash.envs?.length) {
          setEnvSel(hash.envs);
          if (envs[hash.envs[0]]) setStateA(envs[hash.envs[0]].state);
          if (envs[hash.envs[1]]) setStateB(envs[hash.envs[1]].state);
        } else if (idx.graph_param_list?.length > 1) {
          setStateB(stateFromGraphParam(idx.graph_param_list[1]));
          setEnvSel([0, 1]);
        } else {
          setStateB(clean);
          setEnvSel([0]);
        }
        const revs = Object.keys(idx.revision_to_hash).map(Number).sort((a, b) => a - b);
        if (revs.length) {
          setRevA(revs[Math.max(0, revs.length - 6)]);
          setRevB(revs[revs.length - 1]);
        }
        if (hash.view && (ALL_VIEWS as readonly string[]).includes(hash.view)) {
          setView(hash.view as AppView);
        }
        if (hash.bench && idx.benchmarks[hash.bench]) {
          setSelected(hash.bench);
          if (!hash.view) setView("explore");
        }
        if (hash.factor != null) {
          setFactor(hash.factor);
          setRegFactor(hash.factor);
        }
        if (hash.pairMode) setPairMode(hash.pairMode);
        if (hash.params) setParamSel(hash.params);
        if (hash.types) setTypeFilters(hash.types);
        if (hash.onlyRegressed) setOnlyRegressed(true);
        if (hash.machines?.length) setMachineOverlay(hash.machines);
        else if (idx.params.machine?.length) setMachineOverlay([clean.machine || idx.params.machine[0]]);
        if (hash.sub === "report") setExploreSub("report");
        document.title = `${idx.project} · asv tachyon`;

        const [reg, cm, pr, pubMute] = await Promise.all([
          loadRegressions(),
          loadCommits(),
          loadProfiles(),
          loadPublishedMuteList(),
        ]);
        if (cancelled) return;
        if (reg == null) {
          setRegMissing(true);
          setRegressions([]);
        } else {
          setRegMissing(false);
          setRegressions(parseRegressions(reg));
        }
        setCommits(cm);
        setProfiles(pr);
        setMuteList((local) => mergeMuteLists(local, pubMute));
        setHashReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // URL hash write
  useEffect(() => {
    if (!hashReady || !index) return;
    const next = formatHash({
      view,
      bench: selected || undefined,
      filters: state,
      params: paramSel || undefined,
      factor: view === "regressions" ? regFactor : factor,
      envs: pairMode === "env" ? envSel : undefined,
      pairMode: view === "compare" ? pairMode : undefined,
      types: typeFilters.length ? typeFilters : undefined,
      onlyRegressed: onlyRegressed || undefined,
      machines: machineOverlay.length > 1 ? machineOverlay : undefined,
      sub: view === "explore" && exploreSub === "report" ? "report" : undefined,
    });
    if (next !== window.location.hash) {
      history.replaceState(null, "", next || window.location.pathname + window.location.search);
    }
  }, [
    hashReady, index, view, selected, state, paramSel, factor, regFactor,
    envSel, pairMode, typeFilters, onlyRegressed, machineOverlay, exploreSub,
  ]);

  const benchesAll = useMemo(() => {
    if (!index) return [] as BenchmarkInfo[];
    const q = query.trim().toLowerCase();
    return Object.values(index.benchmarks)
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index, query]);

  const benchesTyped = useMemo(
    () => filterBenchesByType(benchesAll, typeFilters),
    [benchesAll, typeFilters],
  );

  const benches = useMemo(() => {
    if (!onlyRegressed) return benchesTyped;
    return benchesTyped.filter((b) => regressedNames.has(b.name));
  }, [benchesTyped, onlyRegressed, regressedNames]);

  const envColumns: EnvColumn[] = useMemo(
    () => (index ? graphParamStates(index) : []),
    [index],
  );

  const machineNames = useMemo(
    () => (index?.params?.machine ? [...index.params.machine] : []),
    [index],
  );

  // Sparklines + regressed set for overview
  useEffect(() => {
    if (!index || !Object.keys(state).length) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, number[]> = {};
      const bands: Record<string, { lo?: number | null; hi?: number | null }> = {};
      const regressed = new Set<string>();
      await Promise.all(
        Object.keys(index.benchmarks).map(async (name) => {
          try {
            const pts = await loadGraph(graphToPath(name, state));
            const r = richSeries(pts);
            next[name] = downsample(r.x, r.y, 28).y;
            if (r.lo.length && r.hi.length) {
              bands[name] = {
                lo: r.lo[r.lo.length - 1],
                hi: r.hi[r.hi.length - 1],
              };
            }
            if (r.y.length >= 2) {
              const prev = r.y[r.y.length - 2];
              const last = r.y[r.y.length - 1];
              const hib = isHigherBetter(index.benchmarks[name]);
              if (prev && last) {
                const worse = hib ? last < prev / 1.05 : last > prev * 1.05;
                if (worse) regressed.add(name);
              }
            }
          } catch {
            next[name] = [];
          }
        }),
      );
      if (!cancelled) {
        setSparks(next);
        setSparkBands(bands);
        setRegressedNames(regressed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [index, state]);

  // Explore graph
  useEffect(() => {
    if (!index || !selected) return;
    setLoadingGraph(true);
    const bench = index.benchmarks[selected];
    const combos = paramCombos(bench);
    const hasParams = (bench.params || []).length > 0;
    const path = graphToPath(selected, state);
    loadGraph(path)
      .then(async (pts) => {
        const r = richSeries(pts);
        setRich(r);
        // samples: from last rev extended point, or sibling samples file
        let sm: number[] = [];
        if (r.x.length) {
          const lastRev = r.x[r.x.length - 1];
          sm = r.samplesByRev[lastRev] || [];
        }
        if (!sm.length) {
          const sibling = await loadSiblingSamples(path);
          if (sibling && r.x.length) {
            const lastRev = r.x[r.x.length - 1];
            sm = sibling[String(lastRev)] || sibling[lastRev] || [];
          }
        }
        setSamples(sm);

        if (hasParams) {
          const valid = new Set(combos.map((c) => c.index));
          const clamped =
            paramSel && paramSel.length
              ? paramSel.filter((i) => valid.has(i))
              : [];
          const sel = clamped.length
            ? clamped
            : combos.slice(0, Math.min(3, combos.length)).map((c) => c.index);
          const multi = multiSeriesFromGraph(pts, combos, sel);
          setMultiSeries(multi);
          const first = multi.series[0];
          const y = (first?.y || []).map((v) => (v == null ? NaN : v)).filter((v) => Number.isFinite(v));
          const x = multi.x.filter((_, i) => first && first.y[i] != null);
          setSeries({ x, y });
        } else {
          const s = { x: r.x, y: r.y };
          setSeries(s);
          setMultiSeries({
            x: s.x,
            series: [
              {
                index: 0,
                label: bench.name,
                color: "#2dd4bf",
                y: s.y,
              },
            ],
          });
        }
      })
      .catch(() => {
        setSeries({ x: [], y: [] });
        setMultiSeries({ x: [], series: [] });
        setRich(null);
        setSamples([]);
      })
      .finally(() => setLoadingGraph(false));
  }, [index, selected, state, paramSel]);

  // Multi-machine overlay for Explore
  useEffect(() => {
    if (!index || !selected || machineOverlay.length < 2) {
      setMachineSeries(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const seriesList: NamedSeries[] = [];
      let xs: number[] = [];
      for (let mi = 0; mi < machineOverlay.length; mi++) {
        const m = machineOverlay[mi];
        const st = { ...state, machine: m };
        try {
          const s = scalarSeries(await loadGraph(graphToPath(selected, st)));
          if (!xs.length) xs = s.x;
          const map = new Map(s.x.map((x, i) => [x, s.y[i]]));
          const y = xs.map((x) => map.get(x) ?? null);
          seriesList.push({
            index: mi,
            label: m,
            color: seriesColor(mi),
            y,
          });
        } catch {
          seriesList.push({
            index: mi,
            label: m,
            color: seriesColor(mi),
            y: xs.map(() => null),
          });
        }
      }
      if (!cancelled) setMachineSeries({ x: xs, series: seriesList });
    })();
    return () => {
      cancelled = true;
    };
  }, [index, selected, state, machineOverlay]);

  // Compare values
  useEffect(() => {
    if (!index || view !== "compare") return;
    let cancelled = false;
    setPairLoading(true);
    (async () => {
      const names = Object.keys(index.benchmarks);
      if (pairMode === "revision") {
        const a: Record<string, number | null> = {};
        const b: Record<string, number | null> = {};
        await Promise.all(
          names.map(async (name) => {
            try {
              const s = scalarSeries(await loadGraph(graphToPath(name, state)));
              a[name] = revA != null ? valueAtRevision(s, revA) : null;
              b[name] = revB != null ? valueAtRevision(s, revB) : null;
            } catch {
              a[name] = null;
              b[name] = null;
            }
          }),
        );
        if (!cancelled) {
          setPairValsA(a);
          setPairValsB(b);
          setMultiEnvVals([]);
          setPairLoading(false);
        }
        return;
      }

      const cols = envSel
        .map((i) => envColumns[i])
        .filter((c): c is EnvColumn => !!c);
      if (!cols.length && envColumns.length) {
        cols.push(envColumns[0]);
        if (envColumns[1]) cols.push(envColumns[1]);
      }
      const buckets: Record<string, number | null>[] = cols.map(() => ({}));
      await Promise.all(
        names.map(async (name) => {
          await Promise.all(
            cols.map(async (col, ci) => {
              try {
                const s = scalarSeries(await loadGraph(graphToPath(name, col.state)));
                buckets[ci][name] = s.y.length ? s.y[s.y.length - 1] : null;
              } catch {
                buckets[ci][name] = null;
              }
            }),
          );
        }),
      );
      if (!cancelled) {
        setMultiEnvVals(buckets);
        if (buckets[0]) setPairValsA(buckets[0]);
        if (buckets[1]) setPairValsB(buckets[1]);
        else setPairValsB({});
        if (cols[0]) setStateA(cols[0].state);
        if (cols[1]) setStateB(cols[1].state);
        setPairLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [index, view, pairMode, state, revA, revB, envSel, envColumns]);

  const openBench = useCallback((name: string, paramIdx?: number) => {
    setSelected(name);
    if (paramIdx != null) setParamSel([paramIdx]);
    setView("explore");
  }, []);

  const openFromRegression = useCallback(
    (bench: string, filters: Record<string, string>, paramIdx: number | null) => {
      setState((s) => ({ ...s, ...filters }));
      setSelected(bench);
      if (paramIdx != null) setParamSel([paramIdx]);
      setView("explore");
    },
    [],
  );

  function toggleParam(idx: number) {
    setParamSel((prev) => {
      const combos = index && selected ? paramCombos(index.benchmarks[selected]) : [];
      const base =
        prev && prev.length
          ? [...prev]
          : combos.slice(0, Math.min(3, combos.length)).map((c) => c.index);
      if (base.includes(idx)) {
        const next = base.filter((i) => i !== idx);
        return next.length ? next : base;
      }
      return [...base, idx].sort((a, b) => a - b);
    });
  }

  function toggleEnvColumn(idx: number) {
    setEnvSel((prev) => {
      if (prev.includes(idx)) {
        if (prev.length <= 1) return prev;
        return prev.filter((i) => i !== idx);
      }
      return [...prev, idx];
    });
  }

  function handleToggleMute(bench: string) {
    setMuteList((prev) => {
      const next = toggleMute(prev, bench);
      saveMuteList(next);
      return next;
    });
  }

  if (error) {
    return (
      <div className="main">
        <div className="error">
          <strong>Could not load ASV data.</strong>
          <p>{error}</p>
        </div>
        <EmptyState kind="no-index" />
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
  const combos = bench ? paramCombos(bench) : [];
  const hasParams = bench ? (bench.params || []).length > 0 : false;
  const activeParamSel = (() => {
    const valid = new Set(combos.map((c) => c.index));
    const clamped =
      paramSel && paramSel.length ? paramSel.filter((i) => valid.has(i)) : [];
    return clamped.length
      ? clamped
      : combos.slice(0, Math.min(3, combos.length)).map((c) => c.index);
  })();

  const benchMeta = Object.fromEntries(
    Object.values(index.benchmarks).map((b) => [
      b.name,
      { unit: b.unit, type: b.type, less_is_better: b.less_is_better },
    ]),
  );

  const multiRows: MultiEnvRow[] =
    pairMode === "env" && multiEnvVals.length >= 1
      ? buildMultiEnvRows(
          benches.map((b) => b.name),
          benchMeta,
          multiEnvVals[0] || {},
          multiEnvVals.slice(1),
          { factor, onlyChanged, sort: sortPair },
        )
      : [];

  const selectedEnvCols = envSel
    .map((i) => envColumns[i])
    .filter((c): c is EnvColumn => !!c);

  const tags = tagMarkers(index);
  const lastRev = series.x.length ? series.x[series.x.length - 1] : null;
  const prof = selected && lastRev != null ? profilePath(profiles, selected, lastRev) : selected ? profilePath(profiles, selected) : null;

  const chartX = machineSeries && machineSeries.series.length > 1 ? machineSeries.x : multiSeries.x;
  const bandOk =
    !!rich &&
    rich.lo.length === chartX.length &&
    rich.hi.length === chartX.length &&
    !(machineSeries && machineSeries.series.length > 1);

  const chartSeries =
    machineSeries && machineSeries.series.length > 1
      ? machineSeries.series.map((s) => ({ label: s.label, y: s.y, color: s.color }))
      : multiSeries.series.map((s) => ({
          label: s.label,
          y: s.y,
          color: s.color,
          lo: s.index === 0 && bandOk ? rich!.lo : undefined,
          hi: s.index === 0 && bandOk ? rich!.hi : undefined,
        }));

  const navViews: { id: AppView; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "explore", label: "Explore" },
    { id: "heatmap", label: "Heatmap" },
    { id: "grid", label: "Grid" },
    { id: "multiples", label: "Multiples" },
    { id: "compare", label: "Compare" },
    { id: "regressions", label: "Regressions" },
    { id: "inventory", label: "Inventory" },
  ];

  return (
    <div className="app">
      <header className="topbar no-print-controls">
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

        <div className="seg seg-scroll" role="tablist">
          {navViews.map((v) => (
            <button
              key={v.id}
              type="button"
              className={view === v.id ? "active" : ""}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
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
          <CopyDeepLinkButton />
          <PrintButton />
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

          <FilterChips
            benches={benchesAll}
            types={typeFilters}
            setTypes={setTypeFilters}
            onlyRegressed={onlyRegressed}
            setOnlyRegressed={setOnlyRegressed}
            regressedCount={regressedNames.size}
          />

          <div className="bento" style={{ marginTop: "0.85rem" }}>
            <div className="card hero fade-in">
              <div>
                <h2>Watch the curves, not the chrome</h2>
                <p>
                  Overview tiles stream sparklines from the published graph tree. Explore for full
                  charts, distributions, and param overlays. Copy deep link shares the hash.
                  Filters are preserved when you switch benchmarks.
                </p>
              </div>
              <div className="kpi-row">
                <div className="kpi"><div className="k">Project</div><div className="v" style={{ fontSize: "1rem" }}>{index.project}</div></div>
                <div className="kpi"><div className="k">Tags</div><div className="v">{Object.keys(index.tags || {}).length}</div></div>
                <div className="kpi"><div className="k">Machines</div><div className="v">{Object.keys(index.machines || {}).length}</div></div>
              </div>
            </div>

            {!benches.length ? (
              <div style={{ gridColumn: "span 12" }}>
                <EmptyState kind="no-benches" />
              </div>
            ) : (
              <OverviewTiles
                benches={benches}
                sparks={sparks}
                sparkBands={sparkBands}
                onOpen={openBench}
              />
            )}
          </div>
        </div>
      )}

      {view === "heatmap" && (
        <HeatmapView
          index={index}
          benches={benches}
          state={state}
          onOpen={openBench}
        />
      )}

      {view === "grid" && (
        <SummaryGrid
          index={index}
          benches={benches}
          state={state}
          onOpen={openBench}
        />
      )}

      {view === "multiples" && (
        <MultiplesView
          index={index}
          benches={benches}
          state={state}
          selected={
            multiplesSel.length
              ? multiplesSel
              : benches.slice(0, Math.min(4, benches.length)).map((b) => b.name)
          }
          setSelected={(names) => setMultiplesSel(names)}
          onOpen={openBench}
        />
      )}

      {view === "explore" && (
        <div className="shell">
          <aside className="sidebar no-print-controls">
            <h3 style={{ margin: "0 0 0.75rem", color: "var(--text-faint)", fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Library
            </h3>
            <FilterChips
              benches={benchesAll}
              types={typeFilters}
              setTypes={setTypeFilters}
              machines={machineNames}
              machineSel={machineOverlay}
              setMachineSel={setMachineOverlay}
              onlyRegressed={onlyRegressed}
              setOnlyRegressed={setOnlyRegressed}
              regressedCount={regressedNames.size}
            />
            <div className="bench-list" style={{ marginTop: "0.65rem" }}>
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
                      {hasParams && <span className="chip">{combos.length} param series</span>}
                      {isHigherBetter(bench) && <span className="chip ok">higher is better</span>}
                    </p>
                  </div>
                  <div className="seg">
                    <button type="button" className={exploreSub === "chart" ? "active" : ""} onClick={() => setExploreSub("chart")}>
                      Chart
                    </button>
                    <button type="button" className={exploreSub === "report" ? "active" : ""} onClick={() => setExploreSub("report")}>
                      Report
                    </button>
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

                {hasParams && (
                  <div className="card card-pad param-picker">
                    <h3 style={{ margin: "0 0 0.55rem", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)" }}>
                      Param series (stable colors)
                    </h3>
                    <div className="param-chips">
                      {combos.map((c) => {
                        const on = activeParamSel.includes(c.index);
                        const color = seriesColor(c.index);
                        return (
                          <button
                            key={c.index}
                            type="button"
                            className={"param-chip" + (on ? " on" : "")}
                            style={on ? { borderColor: color } : undefined}
                            onClick={() => toggleParam(c.index)}
                          >
                            <span className="swatch" style={{ background: color }} />
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="stat-grid">
                  <div className="stat"><div className="k">Latest</div><div className="v">{stats.latest != null ? prettyUnit(stats.latest, unit) : "—"}</div></div>
                  <div className="stat"><div className="k">Min</div><div className="v">{stats.min != null ? prettyUnit(stats.min, unit) : "—"}</div></div>
                  <div className="stat"><div className="k">Max</div><div className="v">{stats.max != null ? prettyUnit(stats.max, unit) : "—"}</div></div>
                  <div className="stat"><div className="k">Δ first→last</div><div className={"v " + (bench ? deltaClass(stats.change, isHigherBetter(bench)) : "")}>{stats.change != null ? `${(stats.change * 100).toFixed(1)}%` : "—"}</div></div>
                </div>
                <div className="detail-grid">
                  <div>
                    <div className="card chart-card">
                      {loadingGraph ? (
                        <p className="muted">Loading graph…</p>
                      ) : chartX.length === 0 ? (
                        <EmptyState kind="empty-graphs" />
                      ) : (
                        <Chart
                          x={chartX}
                          unit={unit}
                          series={chartSeries}
                          showLegend={chartSeries.length > 1}
                          lo={rich?.lo}
                          hi={rich?.hi}
                          tags={tags}
                          tagMode={tagMode}
                          formatRev={(rev) => commitHash(index, rev)}
                          commitMessage={(rev) =>
                            commitMessage(commits, rev, fullCommitHash(index, rev))
                          }
                          showCommitUrl={index.show_commit_url}
                          fullHash={(rev) => fullCommitHash(index, rev)}
                          brushZoom
                          dualCursor
                        />
                      )}
                      {chartX.length > 0 && (
                        <div className="chart-toolbar">
                          <label className="filter chart-tag-mode" title={TAG_DISPLAY_MODES.find((m) => m.id === tagMode)?.hint}>
                            <span>Tags</span>
                            <select
                              value={tagMode}
                              onChange={(e) => setTagMode(e.target.value as TagDisplayMode)}
                            >
                              {TAG_DISPLAY_MODES.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span className="muted chart-tag-hint">
                            {TAG_DISPLAY_MODES.find((m) => m.id === tagMode)?.hint}
                            {tags.length > 0 ? ` · ${tags.length} tags` : ""}
                          </span>
                        </div>
                      )}
                      {chartX.length > 0 && (
                        <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.82rem" }}>
                          last <code>{commitHash(index, chartX[chartX.length - 1])}</code>
                          {index.show_commit_url && (
                            <> · <a href={index.show_commit_url + (fullCommitHash(index, chartX[chartX.length - 1]) || commitHash(index, chartX[chartX.length - 1]))} target="_blank" rel="noreferrer">open commit</a></>
                          )}
                          {prof && (
                            <> · <a href={prof} target="_blank" rel="noreferrer">Open profile</a></>
                          )}
                        </p>
                      )}
                    </div>
                    {samples.length > 0 && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <DistributionPanel
                          samples={samples}
                          unit={unit}
                          revision={lastRev ?? undefined}
                        />
                      </div>
                    )}
                  </div>
                  <div className="side-panel">
                    {exploreSub === "report" && (
                      <ReportSubview
                        index={index}
                        bench={bench}
                        series={series}
                        samples={samples}
                        lastRev={lastRev}
                      />
                    )}
                    <div className="card card-pad">
                      <h3>Recent points</h3>
                      <div className="point-list">
                        {series.x.slice(-8).reverse().map((rev, i) => {
                          const msg = commitMessage(commits, rev, fullCommitHash(index, rev));
                          return (
                            <div className="point-row" key={rev} title={msg || undefined}>
                              <code>{commitHash(index, rev)}</code>
                              <span className="mono">{prettyUnit(series.y[series.y.length - 1 - i], unit)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {bench.code && (
                      <div className="card card-pad source">
                        <h3>Source</h3>
                        <CodeBlock code={bench.code} lang="auto" />
                      </div>
                    )}
                    <div className="card card-pad">
                      <h3>Environment</h3>
                      <div className="chip-row">
                        {Object.entries(state).map(([k, v]) => (
                          <span className="chip" key={k}>{k}: {v}</span>
                        ))}
                      </div>
                      <p className="muted" style={{ margin: "0.55rem 0 0", fontSize: "0.75rem" }}>
                        Filters stay when you pick another benchmark. Shareable via URL hash (Copy link).
                      </p>
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
              <h1>Compare</h1>
              <p>
                Spyglass-style ratios over published graphs — pair or{" "}
                <strong>compare-many</strong> env columns from{" "}
                <code>graph_param_list</code>. Same factor semantics as{" "}
                <code>asv compare</code>.
              </p>
            </div>
            <div className="summary-pills">
              {pairMode === "env" && multiEnvVals.length >= 2 ? (
                (() => {
                  const rows = buildMultiEnvRows(
                    benches.map((b) => b.name),
                    benchMeta,
                    multiEnvVals[0] || {},
                    multiEnvVals.slice(1),
                    { factor, onlyChanged: false },
                  );
                  const nReg = rows.filter((r) => r.contenders.some((c) => c.mark === "+")).length;
                  const nImp = rows.filter((r) => r.contenders.some((c) => c.mark === "-")).length;
                  return (
                    <>
                      <span className="chip ok">{nImp} improved</span>
                      <span className="chip bad">{nReg} regressed</span>
                      <span className="chip">{selectedEnvCols.length} envs</span>
                      <span className="chip">factor {factor}</span>
                    </>
                  );
                })()
              ) : (
                (() => {
                  const rows = buildPairRows(
                    benches.map((b) => b.name),
                    benchMeta,
                    pairValsA,
                    pairValsB,
                    { factor, onlyChanged: false },
                  );
                  return (
                    <>
                      <span className="chip ok">{rows.filter((r) => r.mark === "-").length} improved</span>
                      <span className="chip bad">{rows.filter((r) => r.mark === "+").length} regressed</span>
                      <span className="chip">factor {factor}</span>
                    </>
                  );
                })()
              )}
            </div>
          </div>

          <div className="card pair-toolbar no-print-controls">
            <div className="seg mode-seg">
              <button type="button" className={pairMode === "env" ? "active" : ""} onClick={() => setPairMode("env")}>
                Env columns
              </button>
              <button type="button" className={pairMode === "revision" ? "active" : ""} onClick={() => setPairMode("revision")}>
                Revision pair
              </button>
            </div>

            {pairMode === "env" ? (
              <div className="env-multi">
                <span className="tag">graph_param_list</span>
                <div className="param-chips">
                  {envColumns.map((col, idx) => {
                    const on = envSel.includes(idx);
                    const isBase = on && envSel[0] === idx;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        className={"param-chip" + (on ? " on" : "") + (isBase ? " base" : "")}
                        onClick={() => toggleEnvColumn(idx)}
                        title={isBase ? "Baseline column" : on ? "Contender" : "Add column"}
                      >
                        {isBase ? "Baseline · " : on ? "· " : ""}
                        {col.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="pair-side before">
                  <span className="tag">Before rev</span>
                  <label className="filter">
                    <span>revision</span>
                    <select value={revA ?? ""} onChange={(e) => setRevA(Number(e.target.value))}>
                      {Object.keys(index.revision_to_hash)
                        .map(Number)
                        .sort((a, b) => a - b)
                        .map((r) => (
                          <option key={r} value={r}>
                            {r} · {commitHash(index, r)}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="pair-arrow">→</div>
                <div className="pair-side after">
                  <span className="tag">After rev</span>
                  <label className="filter">
                    <span>revision</span>
                    <select value={revB ?? ""} onChange={(e) => setRevB(Number(e.target.value))}>
                      {Object.keys(index.revision_to_hash)
                        .map(Number)
                        .sort((a, b) => a - b)
                        .map((r) => (
                          <option key={r} value={r}>
                            {r} · {commitHash(index, r)}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="filters" style={{ margin: 0 }}>
                  {Object.entries(index.params).map(([key, values]) => (
                    <label className="filter" key={"env-" + key}>
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
              </>
            )}

            <div className="pair-controls">
              <label className="filter">
                <span>factor</span>
                <input
                  type="number"
                  min={1}
                  step={0.05}
                  value={factor}
                  onChange={(e) => setFactor(Number(e.target.value) || 1.1)}
                />
              </label>
              <label className="filter">
                <span>sort</span>
                <select value={sortPair} onChange={(e) => setSortPair(e.target.value as "default" | "ratio" | "name")}>
                  <option value="ratio">ratio</option>
                  <option value="name">name</option>
                  <option value="default">default</option>
                </select>
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                />
                only changed
              </label>
            </div>
          </div>

          {pairLoading ? (
            <p className="muted">Loading compare series…</p>
          ) : (
            <>
              <div className="card card-pad" style={{ overflow: "auto", marginBottom: "0.9rem" }}>
                {pairMode === "env" && selectedEnvCols.length >= 1 ? (
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th>Benchmark</th>
                        <th>Baseline{selectedEnvCols[0] ? ` (${selectedEnvCols[0].label})` : ""}</th>
                        {selectedEnvCols.slice(1).map((col) => (
                          <th key={col.id}>{col.label} (Ratio)</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {multiRows.map((row) => {
                        const worst = row.contenders.reduce<"green" | "red" | "default" | "grey">(
                          (acc, c) => {
                            if (c.color === "red") return "red";
                            if (acc === "red") return acc;
                            if (c.color === "green") return "green";
                            return acc;
                          },
                          "default",
                        );
                        return (
                          <tr
                            key={row.name}
                            className={"row-" + worst + (selected === row.name ? " selected" : "")}
                            onClick={() => setSelected(row.name)}
                          >
                            <td>
                              <span className="mono">{row.name}</span>{" "}
                              <span className={`chip ${typeChip(row.type)}`}>{row.type}</span>
                            </td>
                            <td className="mono">
                              {row.baseline != null ? prettyUnit(row.baseline, row.unit) : "n/a"}
                            </td>
                            {row.contenders.map((c, i) => (
                              <td key={i} className={"mono cell-" + c.color}>
                                {c.value != null ? prettyUnit(c.value, row.unit) : "n/a"}
                                {" "}
                                <span className="mark">({c.mark}{c.ratio != null ? c.ratio.toFixed(2) : "n/a"})</span>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th>Change</th>
                        <th>Before</th>
                        <th>After</th>
                        <th>Ratio</th>
                        <th>Benchmark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildPairRows(
                        benches.map((b) => b.name),
                        benchMeta,
                        pairValsA,
                        pairValsB,
                        { factor, onlyChanged, sort: sortPair },
                      ).map((row: PairRow) => (
                        <tr
                          key={row.name}
                          className={"row-" + row.color + (selected === row.name ? " selected" : "")}
                          onClick={() => setSelected(row.name)}
                        >
                          <td className="mark">{row.mark}</td>
                          <td className="mono">
                            {row.before != null ? prettyUnit(row.before, row.unit) : "n/a"}
                          </td>
                          <td className="mono">
                            {row.after != null ? prettyUnit(row.after, row.unit) : "n/a"}
                          </td>
                          <td className="mono">
                            {row.ratio != null ? row.ratio.toFixed(2) : "n/a"}
                          </td>
                          <td>
                            <span className="mono">{row.name}</span>{" "}
                            <span className={`chip ${typeChip(row.type)}`}>{row.type}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {selected && pairMode === "env" && selectedEnvCols.length >= 2 && (
                <div className="card chart-card">
                  <h2 style={{ margin: "0.25rem 0 0.75rem" }}>
                    Overlay · <span className="mono">{selected}</span>
                  </h2>
                  <PairOverlay
                    name={selected}
                    stateA={selectedEnvCols[0].state}
                    stateB={selectedEnvCols[1].state}
                    unit={index.benchmarks[selected]?.unit || "seconds"}
                    labelA={selectedEnvCols[0].label}
                    labelB={selectedEnvCols[1].label}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === "regressions" && (
        <RegressionsView
          index={index}
          entries={regressions}
          missing={regMissing}
          factor={regFactor}
          setFactor={setRegFactor}
          onOpen={openFromRegression}
          muteList={muteList}
          onToggleMute={handleToggleMute}
          showMuted={showMuted}
          setShowMuted={setShowMuted}
        />
      )}

      {view === "inventory" && (
        <InventoryView
          index={index}
          stateA={stateA}
          stateB={stateB}
          setStateA={setStateA}
          setStateB={setStateB}
        />
      )}
    </div>
  );
}
