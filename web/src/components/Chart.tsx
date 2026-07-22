import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { prettyUnit, seriesColor } from "../lib/asv";

export type ChartSeries = {
  label: string;
  y: (number | null)[];
  /** Stable color (by param index); when omitted, falls back to palette order. */
  color?: string;
  dash?: number[];
  /** Optional CI band (same length as y). */
  lo?: (number | null)[];
  hi?: (number | null)[];
};

export type TagMarker = { name: string; revision: number };

export type CursorInfo = {
  rev: number;
  hash?: string;
  message?: string;
  values: { label: string; value: number | null }[];
};

type Props = {
  x: number[];
  /** Primary series (used when `series` is not provided). */
  y?: number[];
  unit: string;
  height?: number;
  /** optional second series for pairwise overlay (legacy dual mode) */
  y2?: (number | null)[];
  labelA?: string;
  labelB?: string;
  /** Multi-series overlay; colors are stable per entry when `color` is set. */
  series?: ChartSeries[];
  showLegend?: boolean;
  /** CI band for primary series */
  lo?: (number | null)[];
  hi?: (number | null)[];
  /** Tag markers on x-axis */
  tags?: TagMarker[];
  /** Resolve commit label for revision */
  formatRev?: (rev: number) => string;
  /** Optional commit message for tooltip */
  commitMessage?: (rev: number) => string | null;
  showCommitUrl?: string;
  fullHash?: (rev: number) => string | undefined;
  /** Enable brush select zoom */
  brushZoom?: boolean;
  /** Dual-cursor delta readout */
  dualCursor?: boolean;
};

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function bandFillPlugin(
  lo: (number | null)[],
  hi: (number | null)[],
  color: string,
): uPlot.Plugin {
  return {
    hooks: {
      draw: [
        (u) => {
          const ctx = u.ctx;
          const x0 = u.bbox.left;
          const y0 = u.bbox.top;
          const w = u.bbox.width;
          const h = u.bbox.height;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, y0, w, h);
          ctx.clip();
          const xs = u.data[0] as number[];
          let started = false;
          ctx.beginPath();
          for (let i = 0; i < xs.length; i++) {
            const hiV = hi[i];
            if (hiV == null || !Number.isFinite(hiV)) continue;
            const px = u.valToPos(xs[i], "x", true);
            const py = u.valToPos(hiV, "y", true);
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else ctx.lineTo(px, py);
          }
          for (let i = xs.length - 1; i >= 0; i--) {
            const loV = lo[i];
            if (loV == null || !Number.isFinite(loV)) continue;
            const px = u.valToPos(xs[i], "x", true);
            const py = u.valToPos(loV, "y", true);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();
        },
      ],
    },
  };
}

function tagsPlugin(tags: TagMarker[]): uPlot.Plugin {
  return {
    hooks: {
      draw: [
        (u) => {
          if (!tags.length) return;
          const ctx = u.ctx;
          const y0 = u.bbox.top;
          const y1 = u.bbox.top + u.bbox.height;
          ctx.save();
          ctx.font = "10px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          for (const t of tags) {
            if (t.revision < (u.scales.x.min ?? -Infinity) || t.revision > (u.scales.x.max ?? Infinity))
              continue;
            const px = u.valToPos(t.revision, "x", true);
            ctx.strokeStyle = "rgba(148,163,184,0.45)";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(px, y0);
            ctx.lineTo(px, y1);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = cssVar("--text-faint", "#6b7c96");
            ctx.fillText(t.name, px, y0 + 10);
          }
          ctx.restore();
        },
      ],
    },
  };
}

export function Chart({
  x,
  y,
  unit,
  height = 380,
  y2,
  labelA = "A",
  labelB = "B",
  series: multi,
  showLegend,
  lo,
  hi,
  tags = [],
  formatRev,
  commitMessage,
  showCommitUrl,
  fullHash,
  brushZoom = true,
  dualCursor = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const [cursor, setCursor] = useState<CursorInfo | null>(null);
  const [markers, setMarkers] = useState<[number | null, number | null]>([null, null]);
  const [delta, setDelta] = useState<{ abs: number; pct: number; a: number; b: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!ref.current || !x.length) return;
    const axis = cssVar("--chart-axis", "#8b9bb5");
    const grid = cssVar("--chart-grid", "rgba(148,163,184,0.12)");
    const line = cssVar("--chart-line", "#2dd4bf");
    const line2 = cssVar("--accent-2", "#38bdf8");
    const fill = cssVar("--chart-fill", "rgba(45,212,191,0.12)");
    const bandColor = "rgba(45, 212, 191, 0.14)";

    let plotSeries: uPlot.Series[] = [{}];
    let data: uPlot.AlignedData;
    const plugins: uPlot.Plugin[] = [];

    // primary lo/hi band
    const primaryLo = multi?.[0]?.lo ?? lo;
    const primaryHi = multi?.[0]?.hi ?? hi;
    if (
      primaryLo &&
      primaryHi &&
      primaryLo.length === x.length &&
      primaryHi.some((v) => v != null)
    ) {
      plugins.push(bandFillPlugin(primaryLo, primaryHi, bandColor));
    }

    if (tags.length) plugins.push(tagsPlugin(tags));

    if (multi && multi.length > 0) {
      plotSeries = [
        {},
        ...multi.map((s, i) => {
          const stroke = s.color || seriesColor(i);
          return {
            label: s.label,
            stroke,
            width: 2.5,
            dash: s.dash,
            points: {
              show: x.length < 48,
              size: 4,
              fill: stroke,
              stroke: "#fff",
              width: 1,
            },
          } as uPlot.Series;
        }),
      ];
      data = [x, ...multi.map((s) => s.y.map((v) => (v == null ? null : v)))];
    } else {
      const dual = y2 != null && y2.length === x.length;
      plotSeries = [
        {},
        {
          label: labelA,
          stroke: line,
          width: 2.5,
          fill: dual ? undefined : fill,
          points: { show: x.length < 48, size: 4, fill: line, stroke: "#fff", width: 1 },
        },
      ];
      if (dual) {
        plotSeries.push({
          label: labelB,
          stroke: line2,
          width: 2.5,
          dash: [6, 4],
          points: { show: x.length < 48, size: 4, fill: line2, stroke: "#fff", width: 1 },
        });
      }
      data = dual
        ? [x, y ?? [], y2.map((v) => (v == null ? null : v))]
        : [x, y ?? []];
    }

    const legendOn =
      showLegend != null
        ? showLegend
        : multi
          ? multi.length > 1
          : y2 != null;

    const fmtX = (rev: number) =>
      formatRev ? formatRev(rev) : String(Math.round(rev));

    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height,
      padding: [18, 16, 8, 8],
      plugins,
      cursor: {
        show: true,
        points: { size: 8, width: 1 },
        drag: brushZoom
          ? { x: true, y: false, setScale: true }
          : { x: false, y: false },
      },
      select: brushZoom
        ? { show: true, left: 0, top: 0, width: 0, height: 0 }
        : undefined,
      scales: { x: { time: false }, y: {} },
      axes: [
        {
          stroke: axis,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font: "11px JetBrains Mono, monospace",
          values: (_u, vals) => vals.map((v) => fmtX(v)),
        },
        {
          stroke: axis,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font: "11px JetBrains Mono, monospace",
          size: 64,
          values: (_u, vals) => vals.map((v) => prettyUnit(v, unit)),
        },
      ],
      series: plotSeries,
      legend: { show: legendOn },
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            if (idx == null || idx < 0 || idx >= x.length) {
              setCursor(null);
              return;
            }
            const rev = x[idx];
            const values: CursorInfo["values"] = [];
            if (multi && multi.length) {
              for (const s of multi) {
                const v = s.y[idx];
                values.push({ label: s.label, value: v == null ? null : v });
              }
            } else {
              values.push({ label: labelA, value: y?.[idx] ?? null });
              if (y2) values.push({ label: labelB, value: y2[idx] ?? null });
            }
            const fh = fullHash?.(rev);
            setCursor({
              rev,
              hash: formatRev?.(rev) ?? String(rev),
              message: commitMessage?.(rev) ?? undefined,
              values,
            });
            void fh;
          },
        ],
        setSelect: [
          (u) => {
            if (!brushZoom) return;
            if (u.select.width > 0) setZoomed(true);
          },
        ],
      },
    };

    plot.current?.destroy();
    plot.current = new uPlot(opts, data, ref.current);

    const ro = new ResizeObserver(() => {
      if (ref.current && plot.current) {
        plot.current.setSize({ width: ref.current.clientWidth, height });
      }
    });
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, y2, unit, height, labelA, labelB, multi, showLegend, lo, hi, tags, brushZoom]);

  // dual cursor markers: click to set A then B
  useEffect(() => {
    if (!dualCursor || !ref.current) return;
    const el = ref.current;
    const onClick = (ev: MouseEvent) => {
      if (!plot.current || !cursor) return;
      if (ev.shiftKey || ev.altKey) {
        // reset markers
        setMarkers([null, null]);
        setDelta(null);
        return;
      }
      // only when clicking on chart canvas area
      const target = ev.target as HTMLElement;
      if (!target.closest(".u-wrap") && !target.closest("canvas")) return;
      setMarkers((prev) => {
        const rev = cursor.rev;
        if (prev[0] == null) return [rev, null];
        if (prev[1] == null && rev !== prev[0]) {
          const a = prev[0];
          const b = rev;
          // primary y values
          const ya = valueAt(x, multi?.[0]?.y ?? y ?? [], a);
          const yb = valueAt(x, multi?.[0]?.y ?? y ?? [], b);
          if (ya != null && yb != null && ya !== 0) {
            setDelta({ abs: yb - ya, pct: ((yb - ya) / Math.abs(ya)) * 100, a: ya, b: yb });
          }
          return [a, b];
        }
        // restart
        setDelta(null);
        return [rev, null];
      });
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [dualCursor, cursor, x, y, multi]);

  function resetZoom() {
    if (plot.current) {
      plot.current.setScale("x", { min: x[0], max: x[x.length - 1] });
      setZoomed(false);
    }
  }

  if (!x.length) return <p className="muted">No graph data for this selection.</p>;

  const full = cursor && fullHash ? fullHash(cursor.rev) : undefined;
  const commitHref =
    showCommitUrl && full
      ? showCommitUrl + full
      : showCommitUrl && cursor?.hash
        ? showCommitUrl + cursor.hash
        : null;

  return (
    <div className="chart-panel">
      <div className="chart-wrap" ref={ref} />
      <div className="chart-chrome">
        {cursor && (
          <div className="chart-tooltip">
            <span className="mono">
              rev {cursor.rev}
              {cursor.hash ? ` · ${cursor.hash}` : ""}
            </span>
            {cursor.message && <span className="muted"> — {cursor.message}</span>}
            {commitHref && (
              <>
                {" "}
                <a href={commitHref} target="_blank" rel="noreferrer">
                  commit
                </a>
              </>
            )}
            {cursor.values.map((v) => (
              <span key={v.label} className="mono" style={{ marginLeft: "0.65rem" }}>
                {v.label}: {v.value != null ? prettyUnit(v.value, unit) : "—"}
              </span>
            ))}
          </div>
        )}
        {dualCursor && (
          <div className="chart-delta muted">
            Click two points for delta (Shift+click resets).
            {markers[0] != null && (
              <span className="mono"> A=r{markers[0]}</span>
            )}
            {markers[1] != null && (
              <span className="mono"> B=r{markers[1]}</span>
            )}
            {delta && (
              <span className="mono" style={{ marginLeft: "0.5rem", color: "var(--text)" }}>
                Δ {prettyUnit(delta.abs, unit)} ({delta.pct >= 0 ? "+" : ""}
                {delta.pct.toFixed(2)}%)
              </span>
            )}
          </div>
        )}
        {brushZoom && zoomed && (
          <button type="button" className="btn-ghost" onClick={resetZoom}>
            Reset zoom
          </button>
        )}
      </div>
    </div>
  );
}

function valueAt(x: number[], y: (number | null)[] | number[], rev: number): number | null {
  const i = x.indexOf(rev);
  if (i < 0) return null;
  const v = y[i];
  return v == null || !Number.isFinite(v) ? null : v;
}

export function Sparkline({
  y,
  width = 120,
  height = 36,
  lo,
  hi,
}: {
  y: number[];
  width?: number;
  height?: number;
  /** Optional last-point CI whisker */
  lo?: number | null;
  hi?: number | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || y.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    let min = Math.min(...y);
    let max = Math.max(...y);
    if (lo != null && Number.isFinite(lo)) min = Math.min(min, lo);
    if (hi != null && Number.isFinite(hi)) max = Math.max(max, hi);
    const span = max - min || 1;
    const pad = 3;
    const line =
      getComputedStyle(document.documentElement).getPropertyValue("--chart-line").trim() ||
      "#2dd4bf";
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    y.forEach((v, i) => {
      const px = pad + (i / (y.length - 1)) * (width - pad * 2);
      const py = height - pad - ((v - min) / span) * (height - pad * 2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.stroke();
    const lastX = pad + (width - pad * 2);
    const firstX = pad;
    ctx.lineTo(lastX, height - pad);
    ctx.lineTo(firstX, height - pad);
    ctx.closePath();
    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--chart-fill").trim() ||
      "rgba(45,212,191,0.12)";
    ctx.fill();
    // last-point CI whisker
    if (lo != null && hi != null && Number.isFinite(lo) && Number.isFinite(hi)) {
      const px = lastX;
      const pyLo = height - pad - ((lo - min) / span) * (height - pad * 2);
      const pyHi = height - pad - ((hi - min) / span) * (height - pad * 2);
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, pyHi);
      ctx.lineTo(px, pyLo);
      ctx.moveTo(px - 3, pyHi);
      ctx.lineTo(px + 3, pyHi);
      ctx.moveTo(px - 3, pyLo);
      ctx.lineTo(px + 3, pyLo);
      ctx.stroke();
    }
  }, [y, width, height, lo, hi]);
  return <canvas ref={ref} className="spark" />;
}
