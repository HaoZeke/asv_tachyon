/** localStorage mute list for regressions. */

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
