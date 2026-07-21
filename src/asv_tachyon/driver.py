"""In-environment benchmark driver for Tachyon sampling.

Run under the *target* interpreter (Python 3.15+) via::

    python -m asv_tachyon.driver --benchmark-dir DIR --name NAME [options]

The host CLI wraps this with ``python -m profiling.sampling run ...``.

Benchmark names follow ASV conventions, including parameterized forms
such as ``bench.TimeSuite.time_keys-0``.

The driver calls the raw benchmark function (same target as ``asv profile`` /
``Benchmark.do_profile``), not ``do_run()``. For ``time_*`` benchmarks,
``do_run()`` is the adaptive timeit protocol and is the wrong profiling
target.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path


def _call_benchmark(benchmark) -> None:
    """Invoke the user function once, matching asv_runner do_profile."""
    params = benchmark._build_params()
    if hasattr(benchmark, "redo_setup"):
        # Keep setup side-effects fresh without re-running full suite setup.
        try:
            benchmark.redo_setup()
        except Exception:
            pass
    benchmark.func(*params)


def run_loop(
    benchmark_dir: str,
    name: str,
    *,
    params_json: str | None = None,
    loops: int | None = None,
    duration: float | None = None,
    warmup: int = 1,
) -> int:
    """Execute one ASV benchmark under a loop suitable for sampling."""
    from asv_runner.discovery import get_benchmark_from_name

    extra = json.loads(params_json) if params_json else None
    benchmark = get_benchmark_from_name(
        benchmark_dir, name, extra_params=extra or None
    )

    skip = bool(benchmark.do_setup())
    if skip:
        print(f"SKIP: {name} setup indicated skip", file=sys.stderr)
        return 0

    try:

        def once() -> None:
            _call_benchmark(benchmark)

        for _ in range(max(0, warmup)):
            once()

        if duration is not None and duration > 0:
            deadline = time.perf_counter() + float(duration)
            n = 0
            while time.perf_counter() < deadline:
                once()
                n += 1
            print(
                f"asv-tachyon driver: {n} iterations over {duration}s for {name}",
                flush=True,
            )
            return 0

        if loops is not None:
            n_loops = max(1, int(loops))
            for _ in range(n_loops):
                once()
            print(
                f"asv-tachyon driver: {n_loops} iterations for {name}",
                flush=True,
            )
            return 0

        # Auto: time one iteration, target ~3 s total, clamp [5, 100_000].
        t0 = time.perf_counter()
        once()
        dt = max(time.perf_counter() - t0, 1e-9)
        n_extra = int(math.ceil(3.0 / dt)) - 1
        n_extra = max(4, min(n_extra, 100_000))
        for _ in range(n_extra):
            once()
        print(
            f"asv-tachyon driver: {n_extra + 1} iterations for {name}",
            flush=True,
        )
        return 0
    finally:
        try:
            benchmark.do_teardown()
        except Exception as exc:  # pragma: no cover
            print(f"teardown warning: {exc}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m asv_tachyon.driver",
        description="Run an ASV benchmark in a loop for Tachyon sampling.",
    )
    parser.add_argument(
        "--benchmark-dir",
        required=True,
        help="Path to the benchmarks package directory",
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Fully-qualified benchmark name (as discovered by ASV)",
    )
    parser.add_argument(
        "--params-json",
        default=None,
        help="Optional JSON object of extra asv_runner params",
    )
    parser.add_argument(
        "--loops",
        type=int,
        default=None,
        help="Fixed iteration count after warmup",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=None,
        help="Run for this many wall-clock seconds (overrides --loops)",
    )
    parser.add_argument(
        "--warmup",
        type=int,
        default=1,
        help="Warmup iterations before the timed/sampling loop (default: 1)",
    )
    args = parser.parse_args(argv)

    bench_dir = str(Path(args.benchmark_dir).resolve())
    root = str(Path(bench_dir).parent)
    for path in (root, bench_dir):
        if path not in sys.path:
            sys.path.insert(0, path)

    return run_loop(
        bench_dir,
        args.name,
        params_json=args.params_json,
        loops=args.loops,
        duration=args.duration,
        warmup=args.warmup,
    )


if __name__ == "__main__":
    raise SystemExit(main())
