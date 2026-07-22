/** Mute list for regressions: localStorage + optional publish-tree file. */

const KEY = "asv-tachyon-mute";

export function loadMuteList(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(String);
  } catch {
    return [];
  }
}

export function saveMuteList(names: string[]): void {
  localStorage.setItem(KEY, JSON.stringify([...new Set(names)].sort()));
}

export function isMuted(names: string[], bench: string): boolean {
  return names.includes(bench);
}

export function toggleMute(names: string[], bench: string): string[] {
  if (names.includes(bench)) return names.filter((n) => n !== bench);
  return [...names, bench];
}

/**
 * Optional team-shared mute list from the publish tree.
 * Accepts `["bench.a", "bench.b"]` or `{ "mute": [...], "ignore": [...] }`.
 */
export async function loadPublishedMuteList(base = ""): Promise<string[]> {
  try {
    const res = await fetch(`${base}regressions-ignore.json`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data.map(String);
    if (data && typeof data === "object") {
      const out: string[] = [];
      for (const k of ["mute", "ignore", "benchmarks", "names"] as const) {
        const v = (data as Record<string, unknown>)[k];
        if (Array.isArray(v)) out.push(...v.map(String));
      }
      return [...new Set(out)];
    }
    return [];
  } catch {
    return [];
  }
}

/** Union local + published mutes (local wins for unmuting only locally). */
export function mergeMuteLists(local: string[], published: string[]): string[] {
  return [...new Set([...local, ...published])].sort();
}
