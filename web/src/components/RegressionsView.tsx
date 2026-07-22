import { useMemo } from "react";
import {
  type AsvIndex,
  type RegressionEntry,
  commitHash,
  jumpFactor,
  prettyUnit,
} from "../lib/asv";
import { EmptyState } from "./EmptyState";

function typeChip(t: string) {
  const k = t.toLowerCase();
  if (k.includes("mem")) return "memory";
  if (k.includes("track")) return "track";
  return "time";
}

export function RegressionsView({
  index,
  entries,
  missing,
  factor,
  setFactor,
  onOpen,
  muteList,
  onToggleMute,
  showMuted,
  setShowMuted,
}: {
  index: AsvIndex;
  entries: RegressionEntry[];
  /** true when regressions.json was absent (404). */
  missing: boolean;
  factor: number;
  setFactor: (f: number) => void;
  onOpen: (bench: string, filters: Record<string, string>, paramIdx: number | null) => void;
  muteList: string[];
  onToggleMute: (bench: string) => void;
  showMuted: boolean;
  setShowMuted: (v: boolean) => void;
}) {
  const mutedSet = useMemo(() => new Set(muteList), [muteList]);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => e.factor >= factor)
      .filter((e) => showMuted || !mutedSet.has(e.benchmarkBase))
      .slice()
      .sort((a, b) => b.factor - a.factor || a.name.localeCompare(b.name));
  }, [entries, factor, mutedSet, showMuted]);

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Regressions</h1>
          <p>
            From published <code>regressions.json</code> (same feed as the stock ASV site).
            Raise the factor to keep only larger last/best degradations. Mute hides names
            via localStorage key <code>asv-tachyon-mute</code>.
          </p>
        </div>
        <div className="summary-pills">
          <span className="chip bad">{filtered.length} shown</span>
          <span className="chip">{entries.length} total</span>
          <span className="chip">factor ≥ {factor}</span>
          {muteList.length > 0 && <span className="chip">{muteList.length} muted</span>}
        </div>
      </div>

      <div className="card pair-toolbar">
        <label className="filter">
          <span>factor threshold</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.05}
            value={factor}
            onChange={(e) => setFactor(Number(e.target.value) || 1.1)}
          />
        </label>
        <label className="filter">
          <span>exact</span>
          <input
            type="number"
            min={1}
            step={0.05}
            value={factor}
            onChange={(e) => setFactor(Number(e.target.value) || 1.1)}
          />
        </label>
        <label className="chk">
          <input
            type="checkbox"
            checked={showMuted}
            onChange={(e) => setShowMuted(e.target.checked)}
          />
          show muted
        </label>
        <p className="muted" style={{ margin: 0, fontSize: "0.82rem", alignSelf: "center" }}>
          Keep entries where last/best ≥ threshold (ASV-style magnitude).
        </p>
      </div>

      {missing && <EmptyState kind="no-regressions" />}

      {!missing && entries.length === 0 && (
        <div className="empty muted">regressions.json loaded but contained no rows.</div>
      )}

      {!missing && entries.length > 0 && filtered.length === 0 && (
        <div className="empty muted">
          No regressions at factor ≥ {factor}
          {!showMuted && muteList.length ? " (some muted)" : ""}. Lower the threshold or show muted.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card card-pad" style={{ overflow: "auto" }}>
          <table className="compare-table">
            <thead>
              <tr>
                <th>Benchmark</th>
                <th>Env</th>
                <th>Factor</th>
                <th>Best</th>
                <th>Last</th>
                <th>Jump</th>
                <th>Commits</th>
                <th>Mute</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = index.benchmarks[e.benchmarkBase];
                const unit = meta?.unit || "seconds";
                const lastJump = e.jumps.length ? e.jumps[e.jumps.length - 1] : null;
                const jf = lastJump ? jumpFactor(lastJump) : null;
                const envBits = Object.entries(e.graphParams)
                  .filter(([, v]) => v != null)
                  .map(([k, v]) => `${k}=${v}`);
                const filters: Record<string, string> = {};
                for (const [k, v] of Object.entries(e.graphParams)) {
                  if (v != null) filters[k] = String(v);
                }
                const muted = mutedSet.has(e.benchmarkBase);
                return (
                  <tr
                    key={e.name + JSON.stringify(e.graphParams) + String(e.paramIdx)}
                    className={"row-red" + (muted ? " row-muted" : "")}
                    onClick={() => onOpen(e.benchmarkBase, filters, e.paramIdx)}
                    title="Open in Explore"
                  >
                    <td>
                      <span className="mono">{e.name}</span>{" "}
                      {meta && (
                        <span className={`chip ${typeChip(meta.type)}`}>{meta.type}</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {envBits.length ? envBits.join(" · ") : "—"}
                    </td>
                    <td className="mono">{Number.isFinite(e.factor) ? e.factor.toFixed(2) : "∞"}</td>
                    <td className="mono">{prettyUnit(e.bestValue, unit)}</td>
                    <td className="mono">{prettyUnit(e.lastValue, unit)}</td>
                    <td className="mono">
                      {jf != null
                        ? `${jf.toFixed(2)}×`
                        : lastJump
                          ? "n/a"
                          : "—"}
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {lastJump ? (
                        <>
                          {lastJump[0] != null ? commitHash(index, lastJump[0]) : "…"}
                          {" → "}
                          {commitHash(index, lastJump[1])}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onToggleMute(e.benchmarkBase);
                        }}
                      >
                        {muted ? "Unmute" : "Mute"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
