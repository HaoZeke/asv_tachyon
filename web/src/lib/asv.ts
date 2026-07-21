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
  if (!y.length) return { latest: null as number | null, min: null as number | null, max: null as number | null, change: null as number | null };
  const latest = y[y.length - 1];
  const min = Math.min(...y);
  const max = Math.max(...y);
  const first = y[0];
  const change = first !== 0 ? (latest - first) / Math.abs(first) : null;
  return { latest, min, max, change };
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
