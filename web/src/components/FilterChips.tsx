import { typeKey } from "../lib/asv";
import type { BenchmarkInfo } from "../lib/asv";

const TYPE_OPTS = [
  { key: "time", label: "time" },
  { key: "mem", label: "mem" },
  { key: "peak", label: "peak" },
  { key: "track", label: "track" },
] as const;

export function FilterChips({
  benches,
  types,
  setTypes,
  machines,
  machineSel,
  setMachineSel,
  onlyRegressed,
  setOnlyRegressed,
  regressedCount,
}: {
  benches: BenchmarkInfo[];
  types: string[];
  setTypes: (t: string[]) => void;
  machines?: string[];
  machineSel?: string[];
  setMachineSel?: (m: string[]) => void;
  onlyRegressed: boolean;
  setOnlyRegressed: (v: boolean) => void;
  regressedCount: number;
}) {
  const counts = { time: 0, mem: 0, peak: 0, track: 0, other: 0 };
  for (const b of benches) {
    counts[typeKey(b.type)]++;
  }

  function toggleType(k: string) {
    if (types.includes(k)) setTypes(types.filter((t) => t !== k));
    else setTypes([...types, k]);
  }

  return (
    <div className="filter-chips">
      <div className="param-chips">
        {TYPE_OPTS.map((o) => {
          const on = types.length === 0 || types.includes(o.key);
          const n = counts[o.key];
          return (
            <button
              key={o.key}
              type="button"
              className={"param-chip" + (types.includes(o.key) ? " on" : "")}
              onClick={() => toggleType(o.key)}
              title={on ? `Hide ${o.label}` : `Show ${o.label}`}
            >
              {o.label} <span className="muted">({n})</span>
            </button>
          );
        })}
        <button
          type="button"
          className={"param-chip" + (onlyRegressed ? " on" : "")}
          onClick={() => setOnlyRegressed(!onlyRegressed)}
        >
          only-regressed <span className="muted">({regressedCount})</span>
        </button>
      </div>
      {machines && machines.length > 1 && setMachineSel && machineSel && (
        <div className="param-chips" style={{ marginTop: "0.4rem" }}>
          <span className="muted" style={{ fontSize: "0.75rem", alignSelf: "center" }}>
            machines
          </span>
          {machines.map((m) => {
            const on = machineSel.includes(m);
            return (
              <button
                key={m}
                type="button"
                className={"param-chip" + (on ? " on" : "")}
                onClick={() => {
                  if (on) {
                    if (machineSel.length <= 1) return;
                    setMachineSel(machineSel.filter((x) => x !== m));
                  } else setMachineSel([...machineSel, m]);
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function filterBenchesByType(
  benches: BenchmarkInfo[],
  types: string[],
): BenchmarkInfo[] {
  if (!types.length) return benches;
  return benches.filter((b) => types.includes(typeKey(b.type)));
}
