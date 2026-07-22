#!/usr/bin/env python3
"""Emit a minimal ASV publish tree from Criterion ``target/criterion`` estimates.

Enough for asv-tachyon to open: ``index.json`` + ``graphs/...json`` skeleton.

Usage::

    python adapters/criterion_to_asv.py path/to/target/criterion -o asv_html

Reads each ``*/new/estimates.json`` (or ``base/estimates.json``) under the
Criterion output directory and writes scalar time series of length 1
(revision 1) so tachyon Explore/Overview render.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def _sanitize(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)


def _find_estimates(crit_root: Path) -> list[tuple[str, float]]:
    out: list[tuple[str, float]] = []
    for est in sorted(crit_root.rglob("estimates.json")):
        # prefer new/ over base/
        if est.parent.name not in ("new", "base"):
            continue
        try:
            data = json.loads(est.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        # Criterion: {"mean": {"point_estimate": ...}, ...} or flat
        mean = data.get("mean")
        if isinstance(mean, dict):
            pe = mean.get("point_estimate")
        else:
            pe = data.get("point_estimate") or data.get("mean")
        if pe is None:
            continue
        # bench id = relative path without /new|base/estimates.json
        rel = est.relative_to(crit_root)
        parts = list(rel.parts[:-2])  # drop new/estimates.json
        if not parts:
            parts = [est.parent.parent.name]
        bench = "_".join(parts).replace(" ", "_")
        # de-dupe: prefer new over base
        key = bench
        if est.parent.name == "base" and any(k == key for k, _ in out):
            continue
        if est.parent.name == "new":
            out = [(k, v) for k, v in out if k != key]
        out.append((key, float(pe)))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("criterion_dir", type=Path, help="path to target/criterion")
    ap.add_argument("-o", "--output", type=Path, default=Path("asv_html"))
    ap.add_argument("--project", default="criterion-import")
    ap.add_argument("--machine", default="local")
    ap.add_argument("--branch", default="main")
    args = ap.parse_args(argv)

    crit = args.criterion_dir
    if not crit.is_dir():
        print(f"not a directory: {crit}", file=sys.stderr)
        return 2

    benches = _find_estimates(crit)
    if not benches:
        print(f"no estimates.json under {crit}", file=sys.stderr)
        return 1

    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    graph_dir = out / "graphs" / f"branch-{_sanitize(args.branch)}" / f"machine-{_sanitize(args.machine)}"
    graph_dir.mkdir(parents=True, exist_ok=True)

    benchmarks: dict = {}
    for name, value in benches:
        safe = _sanitize(name)
        # nanoseconds from criterion -> seconds
        seconds = value * 1e-9 if value > 1e-3 else value
        benchmarks[safe] = {
            "name": safe,
            "type": "time",
            "unit": "seconds",
            "params": [],
            "param_names": [],
            "code": f"# imported from Criterion: {name}\n",
        }
        (graph_dir / f"{safe}.json").write_text(
            json.dumps([[1, seconds]]) + "\n"
        )

    index = {
        "project": args.project,
        "project_url": "",
        "show_commit_url": "",
        "hash_length": 8,
        "revision_to_hash": {"1": "criterion0"},
        "revision_to_date": {"1": 0},
        "params": {
            "branch": [args.branch],
            "machine": [args.machine],
        },
        "graph_param_list": [{"branch": args.branch, "machine": args.machine}],
        "machines": {args.machine: {"machine": args.machine}},
        "tags": {},
        "benchmarks": benchmarks,
        "pages": [],
    }
    (out / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    (out / "info.json").write_text(json.dumps({"asv": "criterion-adapter"}) + "\n")
    print(f"wrote {len(benchmarks)} benchmarks -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
