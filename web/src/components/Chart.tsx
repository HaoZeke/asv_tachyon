import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { prettyUnit } from "../lib/asv";

type Props = {
  x: number[];
  y: number[];
  unit: string;
  height?: number;
  /** optional second series for pairwise overlay */
  y2?: (number | null)[];
  labelA?: string;
  labelB?: string;
};

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function Chart({
  x,
  y,
  unit,
  height = 380,
  y2,
  labelA = "A",
  labelB = "B",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current || !x.length) return;
    const axis = cssVar("--chart-axis", "#8b9bb5");
    const grid = cssVar("--chart-grid", "rgba(148,163,184,0.12)");
    const line = cssVar("--chart-line", "#2dd4bf");
    const line2 = cssVar("--accent-2", "#38bdf8");
    const fill = cssVar("--chart-fill", "rgba(45,212,191,0.12)");

    const dual = y2 != null && y2.length === x.length;
    const series: uPlot.Series[] = [
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
      series.push({
        label: labelB,
        stroke: line2,
        width: 2.5,
        dash: [6, 4],
        points: { show: x.length < 48, size: 4, fill: line2, stroke: "#fff", width: 1 },
      });
    }

    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height,
      padding: [12, 16, 8, 8],
      cursor: {
        show: true,
        points: { size: 8, width: 1 },
      },
      scales: { x: { time: false }, y: {} },
      axes: [
        {
          stroke: axis,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid },
          font: "11px JetBrains Mono, monospace",
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
      series,
      legend: dual ? { show: true } : { show: false },
    };

    const data: uPlot.AlignedData = dual
      ? [x, y, y2.map((v) => (v == null ? null : v))]
      : [x, y];

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
  }, [x, y, y2, unit, height, labelA, labelB]);

  if (!x.length) return <p className="muted">No graph data for this selection.</p>;
  return <div className="chart-wrap" ref={ref} />;
}

export function Sparkline({ y, width = 120, height = 36 }: { y: number[]; width?: number; height?: number }) {
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
    const min = Math.min(...y);
    const max = Math.max(...y);
    const span = max - min || 1;
    const pad = 3;
    const line = getComputedStyle(document.documentElement).getPropertyValue("--chart-line").trim() || "#2dd4bf";
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
  }, [y, width, height]);
  return <canvas ref={ref} className="spark" />;
}
