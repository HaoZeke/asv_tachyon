import { useCallback, useMemo, useState, type DragEvent } from "react";
import type { AsvIndex } from "../lib/asv";
import {
  type ChangeKind,
  type ComponentChange,
  type ComponentKind,
  type EnvInventory,
  classifyInventoryDiff,
  displayVersion,
  inventoryFromPublished,
  inventoryFromResultJson,
  summarizeChanges,
} from "../lib/inventory";

type Mode = "published" | "files";
type KindFilter = "default" | "all";

const KIND_META: Record<
  ChangeKind,
  { label: string; className: string; short: string }
> = {
  unchanged: { label: "Unchanged", className: "inv-unchanged", short: "=" },
  added: { label: "Added", className: "inv-added", short: "+" },
  removed: { label: "Removed", className: "inv-removed", short: "−" },
  "version-bumped": { label: "Version bumped", className: "inv-bumped", short: "↕" },
};

function StackBar({ summary }: { summary: ReturnType<typeof summarizeChanges> }) {
  const total =
    summary.unchanged + summary.added + summary.removed + summary["version-bumped"] || 1;
  const segs: { kind: ChangeKind; n: number }[] = [
    { kind: "added", n: summary.added },
    { kind: "version-bumped", n: summary["version-bumped"] },
    { kind: "removed", n: summary.removed },
    { kind: "unchanged", n: summary.unchanged },
  ];
  return (
    <div className="inv-stack" title="Component change mix">
      {segs.map(({ kind, n }) =>
        n > 0 ? (
          <div
            key={kind}
            className={`inv-stack-seg ${KIND_META[kind].className}`}
            style={{ flex: n / total }}
          />
        ) : null,
      )}
    </div>
  );
}

function DropZone({
  label,
  fileName,
  onFile,
}: {
  label: string;
  fileName: string | null;
  onFile: (f: File) => void;
}) {
  const [over, setOver] = useState(false);
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );
  return (
    <label
      className={"inv-drop" + (over ? " over" : "") + (fileName ? " has-file" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <span className="tag">{label}</span>
      <strong>{fileName || "Drop ASV result JSON"}</strong>
      <span className="muted">or click to browse</span>
      <input
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

export function InventoryView({
  index,
  stateA,
  stateB,
  setStateA,
  setStateB,
}: {
  index: AsvIndex;
  stateA: Record<string, string>;
  stateB: Record<string, string>;
  setStateA: (fn: (s: Record<string, string>) => Record<string, string>) => void;
  setStateB: (fn: (s: Record<string, string>) => Record<string, string>) => void;
}) {
  const [mode, setMode] = useState<Mode>("published");
  const [kindFilter, setKindFilter] = useState<KindFilter>("default");
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [fileA, setFileA] = useState<{ name: string; inv: EnvInventory } | null>(null);
  const [fileB, setFileB] = useState<{ name: string; inv: EnvInventory } | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);

  const loadFile = useCallback(async (which: "a" | "b", f: File) => {
    setParseErr(null);
    try {
      const text = await f.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!data || typeof data !== "object") throw new Error("Not a JSON object");
      const inv = inventoryFromResultJson(data, f.name);
      if (which === "a") setFileA({ name: f.name, inv });
      else setFileB({ name: f.name, inv });
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const baseline: EnvInventory | null = useMemo(() => {
    if (mode === "published") return inventoryFromPublished(index, stateA);
    return fileA?.inv ?? null;
  }, [mode, index, stateA, fileA]);

  const contender: EnvInventory | null = useMemo(() => {
    if (mode === "published") return inventoryFromPublished(index, stateB);
    return fileB?.inv ?? null;
  }, [mode, index, stateB, fileB]);

  const kinds: ComponentKind[] | null =
    kindFilter === "all" ? null : ["library", "runtime"];

  const changes: ComponentChange[] = useMemo(() => {
    if (!baseline || !contender) return [];
    return classifyInventoryDiff(baseline, contender, kinds);
  }, [baseline, contender, kinds]);

  const summary = useMemo(() => summarizeChanges(changes), [changes]);
  const rows = onlyChanged
    ? changes.filter((c) => c.kind !== "unchanged")
    : changes;

  const deltaTotal = summary.added + summary.removed + summary["version-bumped"];

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Environment inventory</h1>
          <p>
            SBOM-style lock surface — same classify as{" "}
            <code>asv-spyglass env-diff</code> / eb-stack{" "}
            <code>stack_diff</code> (added · removed · version-bumped · unchanged).
          </p>
        </div>
        <div className="summary-pills">
          <span className="chip ok">{summary.added} added</span>
          <span className="chip bad">{summary.removed} removed</span>
          <span className="chip warn">{summary["version-bumped"]} bumped</span>
          <span className="chip">{summary.unchanged} stable</span>
        </div>
      </div>

      <div className="card pair-toolbar">
        <div className="seg mode-seg">
          <button
            type="button"
            className={mode === "published" ? "active" : ""}
            onClick={() => setMode("published")}
          >
            Published envs
          </button>
          <button
            type="button"
            className={mode === "files" ? "active" : ""}
            onClick={() => setMode("files")}
          >
            Result files
          </button>
        </div>

        {mode === "published" ? (
          <>
            <div className="pair-side before">
              <span className="tag">Baseline</span>
              {Object.entries(index.params).map(([key, values]) => (
                <label className="filter" key={"inv-a-" + key}>
                  <span>{key}</span>
                  <select
                    value={stateA[key] ?? values[0] ?? ""}
                    onChange={(e) =>
                      setStateA((s) => ({ ...s, [key]: e.target.value }))
                    }
                  >
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="pair-arrow">→</div>
            <div className="pair-side after">
              <span className="tag">Contender</span>
              {Object.entries(index.params).map(([key, values]) => (
                <label className="filter" key={"inv-b-" + key}>
                  <span>{key}</span>
                  <select
                    value={stateB[key] ?? values[0] ?? ""}
                    onChange={(e) =>
                      setStateB((s) => ({ ...s, [key]: e.target.value }))
                    }
                  >
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="inv-drops">
            <DropZone
              label="Baseline"
              fileName={fileA?.name ?? null}
              onFile={(f) => loadFile("a", f)}
            />
            <div className="pair-arrow">→</div>
            <DropZone
              label="Contender"
              fileName={fileB?.name ?? null}
              onFile={(f) => loadFile("b", f)}
            />
          </div>
        )}

        <div className="pair-controls">
          <label className="filter">
            <span>kinds</span>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            >
              <option value="default">library + runtime</option>
              <option value="all">all (machine + env)</option>
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

      {parseErr && (
        <div className="error" style={{ marginBottom: "0.9rem" }}>
          Could not parse result file: {parseErr}
        </div>
      )}

      {mode === "files" && (!fileA || !fileB) && (
        <div className="empty muted">
          Drop two ASV result JSON files (the ones under{" "}
          <code>.asv/results/&lt;machine&gt;/</code>) to classify the package /
          runtime inventory — same surface as{" "}
          <code>asv-spyglass env-diff</code>.
        </div>
      )}

      {baseline && contender && (
        <>
          <div className="inv-hero card">
            <div className="inv-hero-left">
              <div className="inv-pair-labels">
                <div>
                  <span className="tag before-tag">Baseline</span>
                  <code className="inv-label">
                    {baseline.envName || baseline.sourceLabel}
                  </code>
                  {baseline.commitHash && (
                    <span className="muted mono">
                      {" "}
                      · {baseline.commitHash.slice(0, 12)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="tag after-tag">Contender</span>
                  <code className="inv-label">
                    {contender.envName || contender.sourceLabel}
                  </code>
                  {contender.commitHash && (
                    <span className="muted mono">
                      {" "}
                      · {contender.commitHash.slice(0, 12)}
                    </span>
                  )}
                </div>
              </div>
              <StackBar summary={summary} />
              <p className="muted" style={{ margin: "0.55rem 0 0", fontSize: "0.82rem" }}>
                {deltaTotal === 0
                  ? "Inventories match under the current kind filter."
                  : `${deltaTotal} component${deltaTotal === 1 ? "" : "s"} changed across the lock surface.`}
              </p>
            </div>
            <div className="inv-kpis">
              {(
                [
                  "added",
                  "removed",
                  "version-bumped",
                  "unchanged",
                ] as ChangeKind[]
              ).map((k) => (
                <div key={k} className={`inv-kpi ${KIND_META[k].className}`}>
                  <div className="k">{KIND_META[k].label}</div>
                  <div className="v">{summary[k]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad" style={{ overflow: "auto" }}>
            <table className="compare-table inv-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Component</th>
                  <th>Baseline</th>
                  <th></th>
                  <th>Contender</th>
                  <th>Kind</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: "center" }}>
                      No component changes under the current filter.
                    </td>
                  </tr>
                )}
                {rows.map((c) => (
                  <tr key={c.name + c.kind} className={"row-" + rowColor(c.kind)}>
                    <td>
                      <span className={`inv-badge ${KIND_META[c.kind].className}`}>
                        {KIND_META[c.kind].short} {KIND_META[c.kind].label}
                      </span>
                    </td>
                    <td>
                      <code className="mono">{c.name}</code>
                    </td>
                    <td className="mono">{displayVersion(c.baselineVersion)}</td>
                    <td className="inv-arrow muted">→</td>
                    <td className="mono">{displayVersion(c.solvedVersion)}</td>
                    <td>
                      <span className="chip">{c.componentKind}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function rowColor(kind: ChangeKind): string {
  if (kind === "added") return "green";
  if (kind === "removed") return "red";
  if (kind === "version-bumped") return "warn";
  return "default";
}
