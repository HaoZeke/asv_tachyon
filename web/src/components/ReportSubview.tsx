import { useMemo } from "react";
import {
  type AsvIndex,
  type BenchmarkInfo,
  commitHash,
  isHigherBetter,
  prettyUnit,
  tagMarkers,
} from "../lib/asv";
import { changePhrase, distSummary } from "../lib/stats";
import { Sparkline } from "./Chart";

type Props = {
  index: AsvIndex;
  bench: BenchmarkInfo;
  series: { x: number[]; y: number[] };
  samples: number[];
  lastRev: number | null;
};

/** Criterion-inspired report: dist stats + history spark + vs previous tag/rev. */
export function ReportSubview({ index, bench, series, samples, lastRev }: Props) {
  const hib = isHigherBetter(bench);
  const summary = useMemo(() => distSummary(samples), [samples]);
  const tags = useMemo(() => tagMarkers(index), [index]);

  const prevTag = useMemo(() => {
    if (lastRev == null) return null;
    const before = tags.filter((t) => t.revision < lastRev);
    return before.length ? before[before.length - 1] : null;
  }, [tags, lastRev]);

  const vsPrevRev = useMemo(() => {
    if (series.y.length < 2) return null;
    const after = series.y[series.y.length - 1];
    const before = series.y[series.y.length - 2];
    return changePhrase(before, after, hib);
  }, [series, hib]);

  const vsTag = useMemo(() => {
    if (!prevTag || !series.x.length) return null;
    const ti = series.x.indexOf(prevTag.revision);
    // nearest at or before tag rev
    let before: number | null = null;
    for (let i = 0; i < series.x.length; i++) {
      if (series.x[i] <= prevTag.revision) before = series.y[i];
    }
    const after = series.y[series.y.length - 1];
    if (before == null || after == null) return null;
    void ti;
    return { tag: prevTag, ...changePhrase(before, after, hib) };
  }, [prevTag, series, hib]);

  const sparkY = series.y.slice(-40);

  return (
    <div className="card card-pad report-subview">
      <h3>Report</h3>
      <div className="report-spark">
        {sparkY.length > 1 ? <Sparkline y={sparkY} width={220} height={44} /> : <span className="muted">No history</span>}
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "0.6rem" }}>
        <div className="stat">
          <div className="k">Latest</div>
          <div className="v">
            {series.y.length
              ? prettyUnit(series.y[series.y.length - 1], bench.unit)
              : "—"}
          </div>
        </div>
        <div className="stat">
          <div className="k">Direction</div>
          <div className="v" style={{ fontSize: "0.85rem" }}>
            {hib ? "higher is better" : "lower is better"}
          </div>
        </div>
      </div>

      {summary && (
        <div className="report-block">
          <h4>Last-rev distribution</h4>
          <ul className="report-list">
            <li>n = {summary.n}</li>
            <li>mean {prettyUnit(summary.mean, bench.unit)}</li>
            <li>median {prettyUnit(summary.median, bench.unit)}</li>
            <li>MAD {prettyUnit(summary.mad, bench.unit)}</li>
          </ul>
        </div>
      )}

      {vsPrevRev && (
        <div className="report-block">
          <h4>Vs previous revision</h4>
          <p className={vsPrevRev.improved ? "delta-down" : vsPrevRev.pct < 0 ? "delta-up" : "muted"}>
            {vsPrevRev.phrase}
            {lastRev != null && series.x.length >= 2 && (
              <span className="muted">
                {" "}
                ({commitHash(index, series.x[series.x.length - 2])} →{" "}
                {commitHash(index, series.x[series.x.length - 1])})
              </span>
            )}
          </p>
        </div>
      )}

      {vsTag && (
        <div className="report-block">
          <h4>Vs previous tag ({vsTag.tag.name})</h4>
          <p className={vsTag.improved ? "delta-down" : "delta-up"}>{vsTag.phrase}</p>
        </div>
      )}
    </div>
  );
}
