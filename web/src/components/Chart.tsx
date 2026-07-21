import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { prettyUnit } from "../lib/asv";

type Props = {
  x: number[];
  y: number[];
  unit: string;
  labels?: string[];
  height?: number;
};

export function Chart({ x, y, unit, height = 360 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current || !x.length) return;

    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height,
      cursor: { show: true },
      scales: { x: { time: false }, y: {} },
      axes: [
        {
          stroke: "#93a0b8",
          grid: { stroke: "#243049", width: 1 },
          ticks: { stroke: "#243049" },
        },
        {
          stroke: "#93a0b8",
          grid: { stroke: "#243049", width: 1 },
          ticks: { stroke: "#243049" },
          values: (_u, vals) => vals.map((v) => prettyUnit(v, unit)),
        },
      ],
      series: [
        {},
        {
          label: "result",
          stroke: "#2dd4bf",
          width: 2,
          points: { show: x.length < 40, size: 3, fill: "#2dd4bf" },
        },
      ],
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            if (idx == null || idx < 0) return;
          },
        ],
      },
    };

    plot.current?.destroy();
    plot.current = new uPlot(opts, [x, y], ref.current);

    const ro = new ResizeObserver(() => {
      if (ref.current && plot.current) {
        plot.current.setSize({
          width: ref.current.clientWidth,
          height,
        });
      }
    });
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
  }, [x, y, unit, height]);

  if (!x.length) {
    return <p className="muted">No graph data for this selection.</p>;
  }
  return <div className="chart-wrap" ref={ref} />;
}
