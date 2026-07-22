import { useMemo } from "react";
import { prettyUnit } from "../lib/asv";
import { distSummary, kdeCurve } from "../lib/stats";

type Props = {
  samples: number[];
  unit: string;
  revision?: number;
  showKde?: boolean;
};

/** Violin + strip + mean/median/MAD (+ optional KDE) for last-revision samples. */
export function DistributionPanel({ samples, unit, revision, showKde = true }: Props) {
  const summary = useMemo(() => distSummary(samples), [samples]);
  const kde = useMemo(
    () => (showKde && samples.length >= 3 ? kdeCurve(samples, 48) : { x: [], y: [] }),
    [samples, showKde],
  );

  if (!summary) {
    return (
      <div className="card card-pad dist-panel">
        <h3>Distribution</h3>
        <p className="muted">No samples on this revision. Extended graph points may carry{" "}
          <code>samples</code>, or drop a sibling under <code>samples/</code>.</p>
      </div>
    );
  }

  const { min, max, mean, median, mad, n } = summary;
  const span = max - min || Math.abs(mean) * 0.1 || 1;
  const pad = span * 0.08;
  const a = min - pad;
  const b = max + pad;
  const W = 280;
  const H = 120;
  const xOf = (v: number) => ((v - a) / (b - a || 1)) * W;
  const maxDens = kde.y.length ? Math.max(...kde.y) : 1;
  // violin half-height from KDE
  const violinPts: string[] = [];
  if (kde.x.length) {
    for (let i = 0; i < kde.x.length; i++) {
      const px = xOf(kde.x[i]);
      const half = (kde.y[i] / maxDens) * (H * 0.38);
      violinPts.push(`${px},${H / 2 - half}`);
    }
    for (let i = kde.x.length - 1; i >= 0; i--) {
      const px = xOf(kde.x[i]);
      const half = (kde.y[i] / maxDens) * (H * 0.38);
      violinPts.push(`${px},${H / 2 + half}`);
    }
  }

  return (
    <div className="card card-pad dist-panel">
      <h3>
        Distribution
        {revision != null && (
          <span className="muted" style={{ fontWeight: 500, marginLeft: "0.4rem" }}>
            · rev {revision} · n={n}
          </span>
        )}
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="dist-svg" role="img" aria-label="Sample distribution">
        {violinPts.length > 0 && (
          <polygon
            points={violinPts.join(" ")}
            fill="color-mix(in oklab, var(--accent) 22%, transparent)"
            stroke="var(--accent)"
            strokeWidth="1"
          />
        )}
        {/* strip plot */}
        {samples.map((s, i) => (
          <circle
            key={i}
            cx={xOf(s)}
            cy={H / 2 + ((i % 5) - 2) * 3}
            r={2.2}
            fill="var(--accent-2)"
            opacity={0.75}
          />
        ))}
        {/* mean / median */}
        <line x1={xOf(mean)} y1={12} x2={xOf(mean)} y2={H - 12} stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="3 2" />
        <line x1={xOf(median)} y1={12} x2={xOf(median)} y2={H - 12} stroke="var(--ok)" strokeWidth="1.5" />
        {/* MAD band around median */}
        <rect
          x={xOf(median - mad)}
          y={H / 2 - 6}
          width={Math.max(1, xOf(median + mad) - xOf(median - mad))}
          height={12}
          fill="color-mix(in oklab, var(--ok) 18%, transparent)"
          rx={2}
        />
      </svg>
      <div className="dist-legend">
        <span><i className="sw mean" /> mean {prettyUnit(mean, unit)}</span>
        <span><i className="sw median" /> median {prettyUnit(median, unit)}</span>
        <span>MAD {prettyUnit(mad, unit)}</span>
        <span className="muted">[{prettyUnit(min, unit)} … {prettyUnit(max, unit)}]</span>
      </div>
      {showKde && kde.x.length > 0 && (
        <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.72rem" }}>
          Gaussian KDE (Silverman bandwidth) under the violin.
        </p>
      )}
    </div>
  );
}
