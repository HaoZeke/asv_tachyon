/** Optional static sidecars: commits.json, profiles.json, samples/. */

export type CommitsMap = {
  /** Full hash -> subject */
  byHash: Record<string, string>;
  /** Revision number (string) -> subject */
  byRevision: Record<string, string>;
};

export async function loadCommits(base = ""): Promise<CommitsMap> {
  const empty: CommitsMap = { byHash: {}, byRevision: {} };
  try {
    const res = await fetch(`${base}commits.json`);
    if (!res.ok) return empty;
    const data = await res.json();
    if (!data || typeof data !== "object") return empty;
    if (data.by_revision && typeof data.by_revision === "object") {
      const byRevision: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.by_revision as Record<string, unknown>)) {
        if (v != null) byRevision[String(k)] = String(v);
      }
      const byHash: Record<string, string> = {};
      if (data.by_hash && typeof data.by_hash === "object") {
        for (const [k, v] of Object.entries(data.by_hash as Record<string, unknown>)) {
          if (v != null) byHash[String(k)] = String(v);
        }
      }
      // also accept top-level hash keys mixed in
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (k === "by_revision" || k === "by_hash") continue;
        if (typeof v === "string" && /^[0-9a-f]{7,40}$/i.test(k)) byHash[k] = v;
      }
      return { byHash, byRevision };
    }
    // flat map of hash -> subject (or revision string -> subject)
    const byHash: Record<string, string> = {};
    const byRevision: Record<string, string> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v == null || typeof v === "object") continue;
      const s = String(v);
      if (/^\d+$/.test(k)) byRevision[k] = s;
      else byHash[k] = s;
    }
    return { byHash, byRevision };
  } catch {
    return empty;
  }
}

export function commitMessage(
  commits: CommitsMap | null | undefined,
  revision: number,
  fullHash?: string,
): string | null {
  if (!commits) return null;
  const byRev = commits.byRevision[String(revision)];
  if (byRev) return byRev;
  if (fullHash) {
    if (commits.byHash[fullHash]) return commits.byHash[fullHash];
    // prefix match
    for (const [h, msg] of Object.entries(commits.byHash)) {
      if (h.startsWith(fullHash) || fullHash.startsWith(h)) return msg;
    }
  }
  return null;
}

export type ProfilesFile = {
  paths: Record<string, string>;
};

export async function loadProfiles(base = ""): Promise<ProfilesFile> {
  try {
    const res = await fetch(`${base}profiles.json`);
    if (!res.ok) return { paths: {} };
    const data = await res.json();
    if (Array.isArray(data)) {
      const paths: Record<string, string> = {};
      for (const item of data) {
        if (item && typeof item === "object" && item.bench && item.path) {
          const key = item.rev != null ? `${item.bench}@${item.rev}` : String(item.bench);
          paths[key] = String(item.path);
        }
      }
      return { paths };
    }
    if (data?.paths && typeof data.paths === "object") {
      const paths: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.paths as Record<string, unknown>)) {
        if (v != null) paths[k] = String(v);
      }
      return { paths };
    }
    // flat map
    if (data && typeof data === "object") {
      const paths: Record<string, string> = {};
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (typeof v === "string") paths[k] = v;
      }
      return { paths };
    }
    return { paths: {} };
  } catch {
    return { paths: {} };
  }
}

/** Look up profile path for bench@rev, then bare bench. */
export function profilePath(
  profiles: ProfilesFile | null | undefined,
  bench: string,
  rev?: number | null,
): string | null {
  if (!profiles?.paths) return null;
  if (rev != null) {
    const k = `${bench}@${rev}`;
    if (profiles.paths[k]) return profiles.paths[k];
  }
  return profiles.paths[bench] ?? null;
}

/** Sibling samples file: samples/<same path as graph> -> { "revision": [samples...] } */
export async function loadSiblingSamples(graphPath: string, base = ""): Promise<Record<string, number[]> | null> {
  // graphs/branch-main/.../time_sort.json -> samples/branch-main/.../time_sort.json
  const rel = graphPath.replace(/^graphs\//, "samples/");
  try {
    const res = await fetch(`${base}${rel}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    const out: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        out[k] = v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
      }
    }
    return out;
  } catch {
    return null;
  }
}
