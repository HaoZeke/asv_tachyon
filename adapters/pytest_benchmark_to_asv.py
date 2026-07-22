#!/usr/bin/env python3
"""Emit a minimal ASV publish tree from pytest-benchmark JSON export.

Usage::

    pytest --benchmark-only --benchmark-json=bench.json
    python adapters/pytest_benchmark_to_asv.py bench.json -o asv_html

Writes ``index.json`` + ``graphs/...json`` skeleton (one revision) so
asv-tachyon can open the site.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def _sanitize(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("benchmark_json", type=Path, help="pytest-benchmark --benchmark-json file")
    ap.add_argument("-o", "--output", type=Path, default=Path("asv_html"))
    ap.add_argument("--project", default="pytest-benchmark-import")
    ap.add_argument("--machine", default="local")
    ap.add_argument("--branch", default="main")
    args = ap.parse_args(argv)

    try:
        data = json.loads(args.benchmark_json.read_text())
    except (OSError, json.JSONDecodeError) as e:
        print(f"failed to read {args.benchmark_json}: {e}", file=sys.stderr)
        return 2

    benchmarks_raw = data.get("benchmarks") or []
    if not benchmarks_raw:
        print("no benchmarks[] in JSON", file=sys.stderr)
        return 1

    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    graph_dir = (
        out / "graphs" / f"branch-{_sanitize(args.branch)}" / f"machine-{_sanitize(args.machine)}"
    )
    graph_dir.mkdir(parents=True, exist_ok=True)

    machine_info = {}
    mi = data.get("machine_info") or {}
    if mi:
        machine_info = {
            "machine": args.machine,
            "os": str(mi.get("system") or mi.get("os") or ""),
            "cpu": str(mi.get("cpu") or mi.get("processor") or ""),
            "arch": str(mi.get("machine") or ""),
        }

    benchmarks: dict = {}
    for b in benchmarks_raw:
        name = str(b.get("fullnamename") or b.get("name") or "bench")
        safe = _sanitize(name)
        stats = b.get("stats") or {}
        # pytest-benchmark times are seconds
        mean = stats.get("mean")
        if mean is None:
            mean = b.get("mean")
        if mean is None:
            continue
        mean_f = float(mean)
        samples = stats.get("data") or b.get("data") or []
        samples_f = [float(x) for x in samples if isinstance(x, (int, float))]
        cell: dict | float
        if samples_f:
            cell = {
                "v": mean_f,
                "lo": min(samples_f),
                "hi": max(samples_f),
                "samples": samples_f[:64],
            }
        else:
            cell = mean_f
        benchmarks[safe] = {
            "name": safe,
            "type": "time",
            "unit": "seconds",
            "params": [],
            "param_names": [],
            "code": f"# pytest-benchmark: {name}\n",
        }
        (graph_dir / f"{safe}.json").write_text(json.dumps([[1, cell]]) + "\n")

    if not benchmarks:
        print("no usable benchmarks with mean", file=sys.stderr)
        return 1

    index = {
        "project": args.project,
        "project_url": "",
        "show_commit_url": "",
        "hash_length": 8,
        "revision_to_hash": {"1": "pytestbm0"},
        "revision_to_date": {"1": 0},
        "params": {
            "branch": [args.branch],
            "machine": [args.machine],
        },
        "graph_param_list": [{"branch": args.branch, "machine": args.machine}],
        "machines": {args.machine: machine_info or {"machine": args.machine}},
        "tags": {},
        "benchmarks": benchmarks,
        "pages": [],
    }
    (out / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    (out / "info.json").write_text(json.dumps({"asv": "pytest-benchmark-adapter"}) + "\n")
    print(f"wrote {len(benchmarks)} benchmarks -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
