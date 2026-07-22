/** Distribution stats for sample arrays (mean, median, MAD, simple Gaussian KDE). */

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median absolute deviation (unscaled). */
export function mad(xs: number[]): number | null {
  const med = median(xs);
  if (med == null) return null;
  return median(xs.map((x) => Math.abs(x - med)));
}

export function stdev(xs: number[]): number | null {
  if (xs.length < 2) return xs.length === 1 ? 0 : null;
  const m = mean(xs)!;
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export type DistSummary = {
  n: number;
  mean: number;
  median: number;
  mad: number;
  min: number;
  max: number;
  stdev: number;
};

export function distSummary(samples: number[]): DistSummary | null {
  const xs = samples.filter((x) => typeof x === "number" && Number.isFinite(x));
  if (!xs.length) return null;
  return {
    n: xs.length,
    mean: mean(xs)!,
    median: median(xs)!,
    mad: mad(xs) ?? 0,
    min: Math.min(...xs),
    max: Math.max(...xs),
    stdev: stdev(xs) ?? 0,
  };
}

/** Silverman's rule-of-thumb bandwidth for Gaussian KDE. */
export function kdeBandwidth(xs: number[]): number {
  if (xs.length < 2) return 1;
  const s = stdev(xs) || 1;
  const iqr =
    percentile(xs, 75)! - percentile(xs, 25)! || s;
  const sigma = Math.min(s, iqr / 1.34) || s;
  return 0.9 * sigma * xs.length ** (-1 / 5) || 1e-12;
}

function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (p / 100) * (s.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo];
  return s[lo] * (hi - i) + s[hi] * (i - lo);
}

/** Evaluate Gaussian KDE on a grid of `n` points spanning [min, max] with pad. */
export function kdeCurve(
  samples: number[],
  n = 64,
): { x: number[]; y: number[] } {
  const xs = samples.filter((v) => Number.isFinite(v));
  if (!xs.length) return { x: [], y: [] };
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = hi - lo || Math.abs(lo) * 0.1 || 1;
  const pad = span * 0.15;
  const a = lo - pad;
  const b = hi + pad;
  const bw = kdeBandwidth(xs);
  const x: number[] = [];
  const y: number[] = [];
  const inv = 1 / (xs.length * bw * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < n; i++) {
    const t = a + ((b - a) * i) / (n - 1 || 1);
    let dens = 0;
    for (const s of xs) {
      const z = (t - s) / bw;
      dens += Math.exp(-0.5 * z * z);
    }
    x.push(t);
    y.push(dens * inv);
  }
  return { x, y };
}

/** Percent change language: higher-is-better flips "faster/slower". */
export function changePhrase(
  before: number,
  after: number,
  higherIsBetter: boolean,
): { factor: number; pct: number; phrase: string; improved: boolean } {
  if (before === 0) {
    return { factor: NaN, pct: NaN, phrase: "n/a", improved: false };
  }
  const ratio = after / before;
  // For lower-is-better: after < before is improvement (ratio < 1)
  // For higher-is-better: after > before is improvement
  const improved = higherIsBetter ? after > before : after < before;
  const speedup = higherIsBetter
    ? after / before
    : before / after;
  const pct = higherIsBetter
    ? ((after - before) / Math.abs(before)) * 100
    : ((before - after) / Math.abs(before)) * 100;
  if (!Number.isFinite(speedup) || Math.abs(ratio - 1) < 1e-12) {
    return { factor: 1, pct: 0, phrase: "unchanged", improved: false };
  }
  if (improved) {
    const phrase =
      speedup >= 1.01
        ? `${speedup.toFixed(2)}x faster`
        : `${Math.abs(pct).toFixed(1)}% faster`;
    return { factor: speedup, pct, phrase, improved: true };
  }
  const slow =
    higherIsBetter
      ? before / after
      : after / before;
  const phrase =
    slow >= 1.01
      ? `${slow.toFixed(2)}x slower`
      : `${Math.abs(((after - before) / Math.abs(before)) * 100).toFixed(1)}% slower`;
  return { factor: slow, pct: -Math.abs(pct), phrase, improved: false };
}
