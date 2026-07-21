/** Load and interpret ASV publish artifacts (index.json + graphs/). */

export type BenchmarkInfo = {
  name: string;
  code?: string;
  unit: string;
  type: string;
  params: string[][];
  param_names: string[];
  timeout?: number;
};

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

export type GraphPoint = [number, number | number[] | null];

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
  if (unit === "seconds") {
    const units: [string, number][] = [
      ["ps", 1e-12], ["ns", 1e-9], ["µs", 1e-6], ["ms", 1e-3],
      ["s", 1], ["m", 60], ["h", 3600],
    ];
    for (let i = 0; i < units.length - 1; i++) {
      if (Math.abs(x) < units[i + 1][1]) return (x / units[i][1]).toFixed(3) + units[i][0];
    }
    return (x / 3600).toFixed(3) + "h";
  }
  if (unit === "bytes") {
    const units: [string, number][] = [["B", 1], ["kB", 1e3], ["MB", 1e6], ["GB", 1e9]];
    for (let i = 0; i < units.length - 1; i++) {
      if (Math.abs(x) < units[i + 1][1]) {
        if (i === 0) return `${Math.round(x)}B`;
        return (x / units[i][1]).toFixed(2) + units[i][0];
      }
    }
    return (x / 1e9).toFixed(2) + "GB";
  }
  return x.toPrecision(4) + (unit && unit !== "unit" ? ` ${unit}` : "");
}

export function commitHash(index: AsvIndex, revision: number): string {
  const full = index.revision_to_hash[String(revision)];
  if (!full) return String(revision);
  return full.slice(0, index.hash_length || 8);
}

export function scalarSeries(points: GraphPoint[]): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (const [rev, val] of points) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      const nums = val.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (!nums.length) continue;
      x.push(rev);
      y.push(nums.reduce((a, b) => a + b, 0) / nums.length);
    } else if (typeof val === "number" && Number.isFinite(val)) {
      x.push(rev);
      y.push(val);
    }
  }
  return { x, y };
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
 */
export function classifyPair(
  before: number | null,
  after: number | null,
  factor = 1.1,
): Pick<PairRow, "ratio" | "mark" | "color"> {
  // Mirrors asv.commands.compare / asv-spyglass (lower is better).
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
  // after clearly better (smaller): before/after > factor  ⇒  after < before/factor
  if (before / after > factor)
    return { ratio, mark: "-", color: "green" };
  // after clearly worse (larger)
  if (after / before > factor)
    return { ratio, mark: "+", color: "red" };
  // magnitude would flip without the factor slack → mark insignificant
  if (ratio !== 1 && (after < before || after > before))
    return { ratio, mark: "~", color: "default" };
  return { ratio, mark: " ", color: "default" };
}

export function buildPairRows(
  names: string[],
  meta: Record<string, { unit: string; type: string }>,
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
    const cls = classifyPair(before, after, factor);
    if (opts.onlyChanged && (cls.mark === " " || cls.mark === "x" || cls.mark === "~"))
      continue;
    rows.push({
      name,
      unit: meta[name]?.unit ?? "seconds",
      type: meta[name]?.type ?? "time",
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
