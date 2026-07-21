/** SBOM-style env inventory + pairwise classify (mirrors asv-spyglass / eb-stack). */

import type { AsvIndex } from "./asv";

export type ComponentKind = "library" | "runtime" | "machine" | "env";

export type Component = {
  name: string;
  version: string;
  kind: ComponentKind;
  purl?: string;
};

export type EnvInventory = {
  machine: string;
  envName: string;
  python: string;
  commitHash: string;
  sourceLabel: string;
  components: Component[];
};

export type ChangeKind = "unchanged" | "added" | "removed" | "version-bumped";

export type ComponentChange = {
  name: string;
  kind: ChangeKind;
  baselineVersion: string | null;
  solvedVersion: string | null;
  componentKind: ComponentKind | string;
};

function trimStr(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.length ? trimStr(v[0]) : "";
  return String(v).trim();
}

function keyOf(name: string): string {
  return name.toLowerCase();
}

export function inventoryFromPublished(
  index: AsvIndex,
  state: Record<string, string>,
  label?: string,
): EnvInventory {
  const components: Component[] = [];
  const python = state.python ?? "";
  const machine = state.machine ?? "";

  if (python) {
    components.push({
      name: "python",
      version: python,
      kind: "runtime",
      purl: `pkg:generic/python@${python}`,
    });
  }

  for (const [k, v] of Object.entries(state)) {
    if (k === "python" || k === "machine") continue;
    // branch / numpy / other matrix axes → library-ish env pins
    components.push({
      name: k,
      version: v ?? "",
      kind: k === "branch" ? "env" : "library",
      purl: v ? `pkg:generic/${k}@${v}` : `pkg:generic/${k}`,
    });
  }

  if (machine) {
    components.push({ name: "asv.machine", version: machine, kind: "env" });
    const m = index.machines?.[machine];
    if (m) {
      for (const key of ["arch", "cpu", "os", "num_cpu", "ram"] as const) {
        if (m[key] != null && m[key] !== "") {
          components.push({
            name: `machine.${key}`,
            version: String(m[key]),
            kind: "machine",
          });
        }
      }
    }
  }

  // encode full selector set as env_name-ish label
  const envName =
    label ||
    Object.entries(state)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

  components.push({ name: "asv.env_name", version: envName, kind: "env" });
  components.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  return {
    machine,
    envName,
    python,
    commitHash: "",
    sourceLabel: envName,
    components,
  };
}

/** Parse a raw ASV result JSON object (same surface as asv-spyglass inventory). */
export function inventoryFromResultJson(
  data: Record<string, unknown>,
  sourceLabel = "result.json",
): EnvInventory {
  const params = (data.params as Record<string, unknown>) || {};
  const machine = String(params.machine ?? "");
  const envName = String(data.env_name ?? "");
  const python = String(data.python ?? params.python ?? "");
  const commitHash = String(data.commit_hash ?? "");
  const components: Component[] = [];

  if (python) {
    components.push({
      name: "python",
      version: trimStr(python),
      kind: "runtime",
      purl: `pkg:generic/python@${trimStr(python)}`,
    });
  }

  const reqs = (data.requirements as Record<string, unknown>) || {};
  for (const name of Object.keys(reqs).sort((a, b) => a.localeCompare(b))) {
    let identity = name;
    if (identity.startsWith("pip+")) identity = identity.slice(4);
    let version = trimStr(reqs[name]);
    if (!version && identity in params) version = trimStr(params[identity]);
    components.push({
      name: identity,
      version,
      kind: "library",
      purl: version ? `pkg:pypi/${identity}@${version}` : `pkg:pypi/${identity}`,
    });
  }

  for (const key of ["arch", "cpu", "os", "num_cpu", "ram"] as const) {
    if (params[key] != null && params[key] !== "") {
      components.push({
        name: `machine.${key}`,
        version: String(params[key]),
        kind: "machine",
      });
    }
  }

  if (envName) {
    components.push({ name: "asv.env_name", version: envName, kind: "env" });
  }

  components.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  return {
    machine,
    envName,
    python: trimStr(python),
    commitHash,
    sourceLabel,
    components,
  };
}

export function classifyInventoryDiff(
  baseline: EnvInventory,
  solved: EnvInventory,
  kinds: ComponentKind[] | null = ["library", "runtime"],
): ComponentChange[] {
  const allow = kinds == null ? null : new Set(kinds.map((k) => k.toLowerCase()));
  const baseBy = new Map<string, Component>();
  const solBy = new Map<string, Component>();
  for (const c of baseline.components) {
    if (allow == null || allow.has(c.kind)) baseBy.set(keyOf(c.name), c);
  }
  for (const c of solved.components) {
    if (allow == null || allow.has(c.kind)) solBy.set(keyOf(c.name), c);
  }

  const names = Array.from(new Set([...baseBy.keys(), ...solBy.keys()])).sort();
  const out: ComponentChange[] = [];
  for (const name of names) {
    const b = baseBy.get(name);
    const s = solBy.get(name);
    if (!b && s) {
      out.push({
        name: s.name,
        kind: "added",
        baselineVersion: null,
        solvedVersion: s.version || "",
        componentKind: s.kind,
      });
    } else if (b && !s) {
      out.push({
        name: b.name,
        kind: "removed",
        baselineVersion: b.version || "",
        solvedVersion: null,
        componentKind: b.kind,
      });
    } else if (b && s) {
      const same = (b.version || "") === (s.version || "");
      out.push({
        name: b.name,
        kind: same ? "unchanged" : "version-bumped",
        baselineVersion: b.version || "",
        solvedVersion: s.version || "",
        componentKind: b.kind,
      });
    }
  }
  return out;
}

export function summarizeChanges(changes: ComponentChange[]) {
  const summary = {
    unchanged: 0,
    added: 0,
    removed: 0,
    "version-bumped": 0,
  };
  for (const c of changes) summary[c.kind] += 1;
  return summary;
}

export function displayVersion(v: string | null | undefined): string {
  if (v == null) return "—";
  if (v === "") return "(empty)";
  return v;
}
