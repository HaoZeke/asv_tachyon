/** Load and interpret ASV publish artifacts (index.json + graphs/). */

export type BenchmarkInfo = {
  name: string;
  code?: string;
  unit: string;
  type: string;
  params: string[][];
  param_names: string[];
  timeout?: number;
  /** When false, larger values are better (throughput / ops). */
  less_is_better?: boolean;
};

/** Extended graph cell: value + optional CI band + raw samples. */
export type GraphValueObject = {
  v: number;
  lo?: number;
  hi?: number;
  samples?: number[];
};

/**
 * Classic: number | number[] (param combos)
 * Extended: { v, lo?, hi?, samples? } or array of those / numbers
 */
export type GraphCell =
  | number
  | number[]
  | GraphValueObject
  | Array<number | GraphValueObject | null>
  | null;

export type AsvIndex = {
  project: string;
  project_url?: string;
  show_commit_url?: string;
  hash_length: number;
  revision_to_hash: Record<string, string>;
  revision_to_date: Record<string, number>;
  params: Record<string, string[]>;
  graph_param_list: Record<string, string | null>[];
  machines: Record<string, Record<string, string>>;
  tags: Record<string, number>;
  benchmarks: Record<string, BenchmarkInfo>;
  pages?: unknown[];
};

export type GraphPoint = [number, GraphCell];

export function isGraphValueObject(v: unknown): v is GraphValueObject {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as GraphValueObject).v === "number"
  );
}

/** Extract finite scalar from a graph cell (mean of params when array). */
export function cellScalar(val: GraphCell): number | null {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (isGraphValueObject(val)) return Number.isFinite(val.v) ? val.v : null;
  if (Array.isArray(val)) {
    const nums: number[] = [];
    for (const item of val) {
      if (typeof item === "number" && Number.isFinite(item)) nums.push(item);
      else if (isGraphValueObject(item) && Number.isFinite(item.v)) nums.push(item.v);
    }
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  return null;
}

export function cellLoHi(val: GraphCell): { lo?: number; hi?: number } {
  if (isGraphValueObject(val)) {
    return {
      lo: typeof val.lo === "number" ? val.lo : undefined,
      hi: typeof val.hi === "number" ? val.hi : undefined,
    };
  }
  return {};
}

export function cellSamples(val: GraphCell): number[] | null {
  if (isGraphValueObject(val) && Array.isArray(val.samples) && val.samples.length) {
    return val.samples.filter((x) => typeof x === "number" && Number.isFinite(x));
  }
  return null;
}

/** Scalar series with optional per-point CI and samples (last revision samples for dist). */
export type RichSeries = {
  x: number[];
  y: number[];
  lo: (number | null)[];
  hi: (number | null)[];
  samplesByRev: Record<number, number[]>;
};

export function richSeries(points: GraphPoint[]): RichSeries {
  const x: number[] = [];
  const y: number[] = [];
  const lo: (number | null)[] = [];
  const hi: (number | null)[] = [];
  const samplesByRev: Record<number, number[]> = {};
  for (const [rev, val] of points) {
    const s = cellScalar(val);
    if (s == null) continue;
    x.push(rev);
    y.push(s);
    const band = cellLoHi(val);
    lo.push(band.lo ?? null);
    hi.push(band.hi ?? null);
    const sm = cellSamples(val);
    if (sm?.length) samplesByRev[rev] = sm;
  }
  return { x, y, lo, hi, samplesByRev };
}

/** True when larger measured values are better (ops/s, track counts, …). */
/** CSS class for a relative change: positive change means "up". */
export function deltaClass(
  change: number | null | undefined,
  higherIsBetter: boolean,
  threshold = 0.05,
): string {
  if (change == null || !Number.isFinite(change)) return "muted";
  if (Math.abs(change) < threshold) return "muted";
  const good = higherIsBetter ? change > 0 : change < 0;
  return good ? "delta-down" : "delta-up";
}

/** Ratio coloring: ratio = after/before. For lower-is-better, ratio>1 is bad. */
export function ratioHeatColor(
  ratio: number | null,
  higherIsBetter: boolean,
): string {
  if (ratio == null || !Number.isFinite(ratio)) return "transparent";
  // Flip interpretation when higher is better: ratio>1 is improvement
  const r = higherIsBetter ? 1 / ratio : ratio;
  if (r >= 1.2) return "color-mix(in oklab, var(--danger) 55%, transparent)";
  if (r >= 1.05) return "color-mix(in oklab, var(--danger) 28%, transparent)";
  if (r <= 0.8) return "color-mix(in oklab, var(--ok) 55%, transparent)";
  if (r <= 0.95) return "color-mix(in oklab, var(--ok) 28%, transparent)";
  return "color-mix(in oklab, var(--text-faint) 8%, transparent)";
}

export function isHigherBetter(bench: Pick<BenchmarkInfo, "type" | "unit" | "less_is_better">): boolean {
  if (bench.less_is_better === false) return true;
  if (bench.less_is_better === true) return false;
  const unit = (bench.unit || "").toLowerCase();
  if (unit.includes("ops")) return true;
  const t = (bench.type || "").toLowerCase();
  if (t === "track") return true;
  return false;
}

/** Spyglass / asv compare-style row */
export type PairRow = {
  name: string;
  unit: string;
  type: string;
  before: number | null;
  after: number | null;
  ratio: number | null;
  /** "-" improved, "+" worsened, "~" insignificant vs factor, " " same, "x" n/a */
  mark: "-" | "+" | "~" | " " | "x" | "!";
  color: "green" | "red" | "default" | "grey";
};

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

export function graphToPath(
  benchmarkName: string,
  state: Record<string, string | null | undefined>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(state)) {
    let part: string;
    if (value === null || value === undefined) part = `${key}-null`;
    else if (value) part = `${key}-${value}`;
    else part = key;
    parts.push(sanitizeFilename(part));
  }
  parts.sort();
  parts.unshift("graphs");
  parts.push(sanitizeFilename(benchmarkName));
  return parts.map(encodeURIComponent).join("/") + ".json";
}

export function defaultState(index: AsvIndex): Record<string, string> {
  if (index.graph_param_list?.length) {
    const first = index.graph_param_list[0];
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(first)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const [k, vals] of Object.entries(index.params || {})) {
    if (vals?.length) out[k] = vals[0];
  }
  return out;
}

export async function loadIndex(base = ""): Promise<AsvIndex> {
  const res = await fetch(`${base}index.json`);
  if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
  return res.json();
}

export async function loadGraph(path: string, base = ""): Promise<GraphPoint[]> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export function prettyUnit(x: number, unit: string): string {
  if (!Number.isFinite(x)) return "—";
  const u = unit || "";
  const ul = u.toLowerCase();
  if (u === "seconds") {
    const units: [string, number][] = [
      ["ps", 1e-12], ["ns", 1e-9], ["µs", 1e-6], ["ms", 1e-3],
      ["s", 1], ["m", 60], ["h", 3600],
    ];
    for (let i = 0; i < units.length - 1; i++) {
      if (Math.abs(x) < units[i + 1][1]) return (x / units[i][1]).toFixed(3) + units[i][0];
    }
    return (x / 3600).toFixed(3) + "h";
  }
  if (u === "bytes") {
    const units: [string, number][] = [["B", 1], ["kB", 1e3], ["MB", 1e6], ["GB", 1e9]];
    for (let i = 0; i < units.length - 1; i++) {
      if (Math.abs(x) < units[i + 1][1]) {
        if (i === 0) return `${Math.round(x)}B`;
        return (x / units[i][1]).toFixed(2) + units[i][0];
      }
    }
    return (x / 1e9).toFixed(2) + "GB";
  }
  if (ul.includes("ops") || ul.includes("/s") || ul === "ops/s") {
    if (Math.abs(x) >= 1e9) return (x / 1e9).toFixed(2) + "G" + (ul.includes("ops") ? "ops/s" : u);
    if (Math.abs(x) >= 1e6) return (x / 1e6).toFixed(2) + "Mops/s";
    if (Math.abs(x) >= 1e3) return (x / 1e3).toFixed(2) + "kops/s";
    return x.toPrecision(4) + (u ? ` ${u}` : " ops/s");
  }
  return x.toPrecision(4) + (u && u !== "unit" ? ` ${u}` : "");
}

export function commitHash(index: AsvIndex, revision: number): string {
  const full = index.revision_to_hash[String(revision)];
  if (!full) return String(revision);
  return full.slice(0, index.hash_length || 8);
}

export function scalarSeries(points: GraphPoint[]): { x: number[]; y: number[] } {
  const rich = richSeries(points);
  return { x: rich.x, y: rich.y };
}

export function seriesStats(y: number[]) {
  if (!y.length)
    return {
      latest: null as number | null,
      min: null as number | null,
      max: null as number | null,
      change: null as number | null,
      first: null as number | null,
    };
  const latest = y[y.length - 1];
  const first = y[0];
  const min = Math.min(...y);
  const max = Math.max(...y);
  const change = first !== 0 ? (latest - first) / Math.abs(first) : null;
  return { latest, min, max, change, first };
}

export function downsample(x: number[], y: number[], maxPoints = 40): { x: number[]; y: number[] } {
  if (x.length <= maxPoints) return { x, y };
  const step = (x.length - 1) / (maxPoints - 1);
  const ox: number[] = [];
  const oy: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    ox.push(x[idx]);
    oy.push(y[idx]);
  }
  return { x: ox, y: oy };
}

export function valueAtRevision(
  series: { x: number[]; y: number[] },
  revision: number,
): number | null {
  const i = series.x.indexOf(revision);
  if (i >= 0) return series.y[i];
  // nearest previous
  let best: number | null = null;
  for (let k = 0; k < series.x.length; k++) {
    if (series.x[k] <= revision) best = series.y[k];
  }
  return best;
}

/**
 * Pairwise classification mirroring asv / asv-spyglass:
 * after/before ratio; factor threshold (default 1.1).
 * Without sample CI we approximate stats with magnitude-only factor.
 * When higherIsBetter, improvement is after > before (throughput / ops).
 */
export function classifyPair(
  before: number | null,
  after: number | null,
  factor = 1.1,
  higherIsBetter = false,
): Pick<PairRow, "ratio" | "mark" | "color"> {
  // Mirrors asv.commands.compare / asv-spyglass (lower is better by default).
  if (before == null && after == null)
    return { ratio: null, mark: " ", color: "default" };
  if (before != null && after == null)
    return { ratio: null, mark: "!", color: "red" }; // introduced failure
  if (before == null && after != null)
    return { ratio: null, mark: " ", color: "green" }; // fixed failure
  if (before == null || after == null)
    return { ratio: null, mark: "x", color: "grey" };
  if (before === 0) {
    return { ratio: after === 0 ? 1 : null, mark: "x", color: "grey" };
  }

  const ratio = after / before;
  if (higherIsBetter) {
    // after clearly better (larger): after/before > factor
    if (after / before > factor)
      return { ratio, mark: "-", color: "green" };
    // after clearly worse (smaller)
    if (before / after > factor)
      return { ratio, mark: "+", color: "red" };
  } else {
    // after clearly better (smaller): before/after > factor
    if (before / after > factor)
      return { ratio, mark: "-", color: "green" };
    // after clearly worse (larger)
    if (after / before > factor)
      return { ratio, mark: "+", color: "red" };
  }
  // magnitude would flip without the factor slack → mark insignificant
  if (ratio !== 1 && (after < before || after > before))
    return { ratio, mark: "~", color: "default" };
  return { ratio, mark: " ", color: "default" };
}

export function buildPairRows(
  names: string[],
  meta: Record<string, { unit: string; type: string; less_is_better?: boolean }>,
  beforeVals: Record<string, number | null>,
  afterVals: Record<string, number | null>,
  opts: {
    factor?: number;
    onlyChanged?: boolean;
    sort?: "default" | "ratio" | "name";
  } = {},
): PairRow[] {
  const factor = opts.factor ?? 1.1;
  const rows: PairRow[] = [];
  for (const name of names) {
    const before = beforeVals[name] ?? null;
    const after = afterVals[name] ?? null;
    const m = meta[name] || { unit: "seconds", type: "time" };
    const hib = isHigherBetter(m);
    const cls = classifyPair(before, after, factor, hib);
    if (opts.onlyChanged && (cls.mark === " " || cls.mark === "x" || cls.mark === "~"))
      continue;
    rows.push({
      name,
      unit: m.unit ?? "seconds",
      type: m.type ?? "time",
      before,
      after,
      ...cls,
    });
  }
  if (opts.sort === "ratio") {
    rows.sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  } else if (opts.sort === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // default: reds first, then greens, then rest
    const order = { red: 0, green: 1, default: 2, grey: 3 };
    rows.sort((a, b) => order[a.color] - order[b.color] || a.name.localeCompare(b.name));
  }
  return rows;
}

export function alignDualSeries(
  a: { x: number[]; y: number[] },
  b: { x: number[]; y: number[] },
): { x: number[]; yA: (number | null)[]; yB: (number | null)[] } {
  const xs = Array.from(new Set([...a.x, ...b.x])).sort((p, q) => p - q);
  const mapA = new Map(a.x.map((v, i) => [v, a.y[i]]));
  const mapB = new Map(b.x.map((v, i) => [v, b.y[i]]));
  return {
    x: xs,
    yA: xs.map((x) => mapA.get(x) ?? null),
    yB: xs.map((x) => mapB.get(x) ?? null),
  };
}

/* —— multi-series param overlays —— */

/** Stable palette keyed by flat param index (hide/show does not reshuffle). */
export const SERIES_PALETTE = [
  "#2dd4bf",
  "#38bdf8",
  "#a78bfa",
  "#fbbf24",
  "#fb7185",
  "#4ade80",
  "#f472b6",
  "#94a3b8",
  "#f97316",
  "#22d3ee",
  "#c084fc",
  "#84cc16",
];

export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export type ParamCombo = {
  index: number;
  label: string;
  values: string[];
};

/** Cartesian product of benchmark.params with flat ASV parameter index. */
export function paramCombos(bench: BenchmarkInfo): ParamCombo[] {
  const dims = bench.params || [];
  const names = bench.param_names || [];
  if (!dims.length) return [{ index: 0, label: "(default)", values: [] }];

  const combos: ParamCombo[] = [];
  const stride: number[] = [];
  let n = 1;
  for (let d = dims.length - 1; d >= 0; d--) {
    stride[d] = n;
    n *= dims[d].length || 1;
  }
  for (let idx = 0; idx < n; idx++) {
    const values: string[] = [];
    const parts: string[] = [];
    for (let d = 0; d < dims.length; d++) {
      const di = Math.floor(idx / stride[d]) % (dims[d].length || 1);
      const v = dims[d][di] ?? String(di);
      values.push(v);
      const name = names[d] || `p${d}`;
      parts.push(`${name}=${v}`);
    }
    combos.push({ index: idx, label: parts.join(", "), values });
  }
  return combos;
}

export type NamedSeries = {
  index: number;
  label: string;
  color: string;
  y: (number | null)[];
};

/**
 * Expand graph points that carry multi-value arrays (one entry per param combo)
 * into separate y-series sharing the same x (revision) axis.
 */
function paramCellAt(val: GraphCell, idx: number): number | null {
  if (val == null) return null;
  if (Array.isArray(val)) {
    const item = val[idx];
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (isGraphValueObject(item)) return Number.isFinite(item.v) ? item.v : null;
    return null;
  }
  if (isGraphValueObject(val)) return idx === 0 && Number.isFinite(val.v) ? val.v : null;
  if (typeof val === "number" && Number.isFinite(val)) return idx === 0 ? val : null;
  return null;
}

export function multiSeriesFromGraph(
  points: GraphPoint[],
  combos: ParamCombo[],
  selectedIndices?: number[] | null,
): { x: number[]; series: NamedSeries[] } {
  const want =
    selectedIndices && selectedIndices.length
      ? new Set(selectedIndices)
      : new Set(combos.map((c) => c.index));

  const active = combos.filter((c) => want.has(c.index));
  const x: number[] = [];
  const buckets: Map<number, (number | null)[]> = new Map();
  for (const c of active) buckets.set(c.index, []);

  for (const [rev, val] of points) {
    x.push(rev);
    for (const c of active) {
      buckets.get(c.index)!.push(paramCellAt(val, c.index));
    }
  }

  const series: NamedSeries[] = active.map((c) => ({
    index: c.index,
    label: c.label,
    color: seriesColor(c.index),
    y: buckets.get(c.index) || [],
  }));
  return { x, series };
}

/* —— regressions.json (ASV publish) —— */

/**
 * One entry from regressions.json:
 * [entry_name, graph_path, graph_params, param_idx, last_v, best_v, jumps]
 * jumps: [[rev_before, rev_after, value_before, value_after], ...]
 * rev_before may be null when the jump is a single commit.
 */
export type RegressionJump = [
  number | null,
  number,
  number | null,
  number | null,
];

export type RegressionEntry = {
  name: string;
  graphPath: string | null;
  graphParams: Record<string, string | null>;
  paramIdx: number | null;
  lastValue: number;
  bestValue: number;
  jumps: RegressionJump[];
  /** last / best (higher = worse for time/memory). */
  factor: number;
  benchmarkBase: string;
};

export type RegressionsFile = {
  regressions: unknown[];
};

export async function loadRegressions(
  base = "",
): Promise<RegressionsFile | null> {
  try {
    const res = await fetch(`${base}regressions.json`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load regressions.json: ${res.status}`);
    return res.json();
  } catch (e) {
    // network / missing file while offline is non-fatal
    if (e instanceof TypeError) return null;
    throw e;
  }
}

function asRecord(v: unknown): Record<string, string | null> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string | null> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = val == null ? null : String(val);
  }
  return out;
}

/** Parse one raw regressions.json row (real ASV shape). */
export function parseRegressionEntry(raw: unknown): RegressionEntry | null {
  if (!Array.isArray(raw) || raw.length < 7) return null;
  const name = String(raw[0] ?? "");
  if (!name) return null;
  const graphPath = raw[1] == null ? null : String(raw[1]);
  const graphParams = asRecord(raw[2]);
  const paramIdx =
    raw[3] == null || raw[3] === "" ? null : Number(raw[3]);
  const lastValue = Number(raw[4]);
  const bestValue = Number(raw[5]);
  const jumpsRaw = raw[6];
  if (!Number.isFinite(lastValue) || !Number.isFinite(bestValue)) return null;
  const jumps: RegressionJump[] = [];
  if (Array.isArray(jumpsRaw)) {
    for (const j of jumpsRaw) {
      if (!Array.isArray(j) || j.length < 4) continue;
      jumps.push([
        j[0] == null ? null : Number(j[0]),
        Number(j[1]),
        j[2] == null ? null : Number(j[2]),
        j[3] == null ? null : Number(j[3]),
      ]);
    }
  }
  const factor = bestValue !== 0 ? lastValue / bestValue : Infinity;
  const benchmarkBase = name.includes("(") ? name.slice(0, name.indexOf("(")) : name;
  return {
    name,
    graphPath,
    graphParams,
    paramIdx: Number.isFinite(paramIdx as number) ? (paramIdx as number) : null,
    lastValue,
    bestValue,
    jumps,
    factor,
    benchmarkBase,
  };
}

export function parseRegressions(data: RegressionsFile | null): RegressionEntry[] {
  if (!data?.regressions?.length) return [];
  const out: RegressionEntry[] = [];
  for (const raw of data.regressions) {
    const e = parseRegressionEntry(raw);
    if (e) out.push(e);
  }
  return out;
}

/** Jump magnitude after/before; falls back to entry factor. */
export function jumpFactor(jump: RegressionJump): number | null {
  const before = jump[2];
  const after = jump[3];
  if (before == null || after == null || before === 0) return null;
  return after / before;
}

/* —— multi-env compare-many —— */

export type EnvColumn = {
  id: string;
  label: string;
  state: Record<string, string>;
};

export type MultiEnvRow = {
  name: string;
  unit: string;
  type: string;
  baseline: number | null;
  contenders: {
    value: number | null;
    ratio: number | null;
    mark: PairRow["mark"];
    color: PairRow["color"];
  }[];
};

export function envLabel(state: Record<string, string>): string {
  return Object.entries(state)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}

export function graphParamStates(index: AsvIndex): EnvColumn[] {
  return (index.graph_param_list || []).map((gp, i) => {
    const state: Record<string, string> = {};
    for (const [k, v] of Object.entries(gp)) {
      if (v != null) state[k] = String(v);
    }
    return { id: String(i), label: envLabel(state) || `env ${i}`, state };
  });
}

export function buildMultiEnvRows(
  names: string[],
  meta: Record<string, { unit: string; type: string; less_is_better?: boolean }>,
  baselineVals: Record<string, number | null>,
  contenderVals: Record<string, number | null>[],
  opts: {
    factor?: number;
    onlyChanged?: boolean;
    sort?: "default" | "ratio" | "name";
  } = {},
): MultiEnvRow[] {
  const factor = opts.factor ?? 1.1;
  const rows: MultiEnvRow[] = [];
  for (const name of names) {
    const baseline = baselineVals[name] ?? null;
    const m = meta[name] || { unit: "seconds", type: "time" };
    const hib = isHigherBetter(m);
    const contenders = contenderVals.map((cv) => {
      const value = cv[name] ?? null;
      const cls = classifyPair(baseline, value, factor, hib);
      return { value, ...cls };
    });
    if (opts.onlyChanged) {
      const anyChanged = contenders.some(
        (c) => c.mark === "+" || c.mark === "-" || c.mark === "!",
      );
      if (!anyChanged) continue;
    }
    rows.push({
      name,
      unit: meta[name]?.unit ?? "seconds",
      type: meta[name]?.type ?? "time",
      baseline,
      contenders,
    });
  }
  if (opts.sort === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else if (opts.sort === "ratio") {
    rows.sort((a, b) => {
      const ra = Math.max(...a.contenders.map((c) => c.ratio ?? 0), 0);
      const rb = Math.max(...b.contenders.map((c) => c.ratio ?? 0), 0);
      return rb - ra;
    });
  } else {
    const order = { red: 0, green: 1, default: 2, grey: 3 };
    rows.sort((a, b) => {
      const ca = Math.min(...a.contenders.map((c) => order[c.color]));
      const cb = Math.min(...b.contenders.map((c) => order[c.color]));
      return ca - cb || a.name.localeCompare(b.name);
    });
  }
  return rows;
}

/* —— URL hash state (shareable explore / filters) —— */

export type AppHashState = {
  view?: string;
  bench?: string;
  /** env selector filters (machine, branch, python, …) */
  filters?: Record<string, string>;
  /** selected param flat indices (comma-separated in hash) */
  params?: number[];
  factor?: number;
  /** graph_param_list indices for multi-env compare (first = baseline) */
  envs?: number[];
  pairMode?: "env" | "revision";
  /** type filter chips: time,mem,peak,track */
  types?: string[];
  /** only benches that regressed vs previous revision */
  onlyRegressed?: boolean;
  /** multi-machine overlay names */
  machines?: string[];
  /** explore report subview */
  sub?: string;
};

export const ALL_VIEWS = [
  "overview",
  "explore",
  "compare",
  "inventory",
  "regressions",
  "heatmap",
  "grid",
  "multiples",
] as const;

export type AppView = (typeof ALL_VIEWS)[number];

export function parseHash(hash = window.location.hash): AppHashState {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return {};
  const params = new URLSearchParams(raw.includes("=") ? raw : "");
  const out: AppHashState = {};
  const view = params.get("view");
  if (view) out.view = view;
  const bench = params.get("bench");
  if (bench) out.bench = bench;
  const factor = params.get("factor");
  if (factor && Number.isFinite(Number(factor))) out.factor = Number(factor);
  const pairMode = params.get("pairMode");
  if (pairMode === "env" || pairMode === "revision") out.pairMode = pairMode;
  const p = params.get("params");
  if (p) {
    out.params = p
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
  }
  const envs = params.get("envs");
  if (envs) {
    out.envs = envs
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
  }
  const types = params.get("types");
  if (types) {
    out.types = types.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (params.get("onlyReg") === "1") out.onlyRegressed = true;
  const machines = params.get("machines");
  if (machines) {
    out.machines = machines.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const sub = params.get("sub");
  if (sub) out.sub = sub;
  const filters: Record<string, string> = {};
  for (const key of ["machine", "branch", "python"]) {
    const v = params.get(key);
    if (v) filters[key] = v;
  }
  params.forEach((v, k) => {
    if (k.startsWith("f-") && v) filters[k.slice(2)] = v;
  });
  if (Object.keys(filters).length) out.filters = filters;
  return out;
}

export function formatHash(state: AppHashState): string {
  const params = new URLSearchParams();
  if (state.view) params.set("view", state.view);
  if (state.bench) params.set("bench", state.bench);
  if (state.factor != null) params.set("factor", String(state.factor));
  if (state.pairMode) params.set("pairMode", state.pairMode);
  if (state.params?.length) params.set("params", state.params.join(","));
  if (state.envs?.length) params.set("envs", state.envs.join(","));
  if (state.types?.length) params.set("types", state.types.join(","));
  if (state.onlyRegressed) params.set("onlyReg", "1");
  if (state.machines?.length) params.set("machines", state.machines.join(","));
  if (state.sub) params.set("sub", state.sub);
  if (state.filters) {
    for (const [k, v] of Object.entries(state.filters)) {
      if (k === "machine" || k === "branch" || k === "python") params.set(k, v);
      else params.set(`f-${k}`, v);
    }
  }
  const s = params.toString();
  return s ? `#${s}` : "";
}

/** Map benchmark type string to coarse chip key. */
export function typeKey(t: string): "time" | "mem" | "peak" | "track" | "other" {
  const k = t.toLowerCase();
  if (k.includes("peak")) return "peak";
  if (k.includes("mem")) return "mem";
  if (k.includes("track")) return "track";
  if (k.includes("time")) return "time";
  return "other";
}

export function fullCommitHash(index: AsvIndex, revision: number): string | undefined {
  return index.revision_to_hash[String(revision)];
}

/** Tags as sorted list of {name, revision} for x-axis markers. */
export function tagMarkers(index: AsvIndex): { name: string; revision: number }[] {
  return Object.entries(index.tags || {})
    .map(([name, rev]) => ({ name, revision: Number(rev) }))
    .filter((t) => Number.isFinite(t.revision))
    .sort((a, b) => a.revision - b.revision);
}
