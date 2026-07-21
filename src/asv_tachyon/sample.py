"""Orchestrate Tachyon sampling of an ASV benchmark."""

from __future__ import annotations

import shlex
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Sequence

from asv_tachyon.util import (
    TachyonError,
    default_output_dir,
    require_sampling_python,
    sanitize_name,
)

FormatName = Literal[
    "pstats",
    "flamegraph",
    "heatmap",
    "gecko",
    "collapsed",
    "binary",
    "diff-flamegraph",
]

FORMAT_FLAGS: dict[str, str] = {
    "pstats": "--pstats",
    "flamegraph": "--flamegraph",
    "heatmap": "--heatmap",
    "gecko": "--gecko",
    "collapsed": "--collapsed",
    "binary": "--binary",
    "diff-flamegraph": "--diff-flamegraph",
}


@dataclass
class SampleRequest:
    """All knobs for a single sampling run."""

    benchmark: str
    benchmark_dir: Path
    python: str
    output: Path | None = None
    fmt: FormatName = "flamegraph"
    mode: str = "wall"
    rate: str = "1khz"
    duration: float | None = None
    loops: int | None = None
    warmup: int = 1
    all_threads: bool = False
    native: bool = False
    opcodes: bool = False
    async_aware: bool = False
    async_mode: str | None = None
    no_gc: bool = False
    subprocesses: bool = False
    blocking: bool = False
    live: bool = False
    browser: bool = False
    sort: str | None = None
    limit: int | None = None
    no_summary: bool = False
    baseline: Path | None = None
    compression: str | None = None
    extra_args: Sequence[str] = field(default_factory=tuple)
    conf_results_dir: Path | None = None
    dry_run: bool = False


@dataclass
class SampleResult:
    command: list[str]
    output: Path | None
    returncode: int


def _resolve_output(req: SampleRequest) -> Path | None:
    if req.live:
        return None
    if req.output is not None:
        out = Path(req.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        return out

    base = default_output_dir(req.conf_results_dir)
    stem = sanitize_name(req.benchmark)
    suffixes = {
        "pstats": f"{stem}.pstats",
        "flamegraph": f"{stem}.flamegraph.html",
        "heatmap": f"{stem}.heatmap",
        "gecko": f"{stem}.gecko.json",
        "collapsed": f"{stem}.collapsed.txt",
        "binary": f"{stem}.tachyon.bin",
        "diff-flamegraph": f"{stem}.diff.html",
    }
    out = base / suffixes[req.fmt]
    if req.fmt != "heatmap":
        out.parent.mkdir(parents=True, exist_ok=True)
    return out


def build_sampling_command(req: SampleRequest) -> tuple[list[str], Path | None]:
    require_sampling_python(req.python)
    out = _resolve_output(req)

    cmd: list[str] = [req.python, "-m", "profiling.sampling", "run"]

    if req.live:
        cmd.append("--live")
    else:
        flag = FORMAT_FLAGS[req.fmt]
        if req.fmt == "diff-flamegraph":
            if req.baseline is None:
                raise TachyonError(
                    "diff-flamegraph format requires --baseline PATH to a .bin capture"
                )
            cmd.extend([flag, str(Path(req.baseline).resolve())])
        else:
            cmd.append(flag)
        if out is not None:
            cmd.extend(["-o", str(out)])
        if req.browser:
            cmd.append("--browser")
        if req.compression and req.fmt == "binary":
            cmd.extend(["--compression", req.compression])

    cmd.extend(["-r", req.rate, "--mode", req.mode])
    if req.all_threads:
        cmd.append("--all-threads")
    if req.native:
        cmd.append("--native")
    if req.opcodes:
        cmd.append("--opcodes")
    if req.no_gc:
        cmd.append("--no-gc")
    if req.subprocesses:
        cmd.append("--subprocesses")
    if req.blocking:
        cmd.append("--blocking")
    if req.async_aware:
        cmd.append("--async-aware")
        if req.async_mode:
            cmd.extend(["--async-mode", req.async_mode])
    if req.sort:
        cmd.extend(["--sort", req.sort])
    if req.limit is not None:
        cmd.extend(["--limit", str(req.limit)])
    if req.no_summary:
        cmd.append("--no-summary")
    if req.extra_args:
        cmd.extend(list(req.extra_args))

    # Profiled target. A bare "--" keeps driver flags out of Tachyon's argparse.
    driver_args = [
        "--benchmark-dir",
        str(Path(req.benchmark_dir).resolve()),
        "--name",
        req.benchmark,
        "--warmup",
        str(req.warmup),
    ]
    if req.duration is not None:
        driver_args.extend(["--duration", str(req.duration)])
    elif req.loops is not None:
        driver_args.extend(["--loops", str(req.loops)])
    cmd.extend(["-m", "asv_tachyon.driver", "--", *driver_args])

    return cmd, out


def run_sample(req: SampleRequest) -> SampleResult:
    """Execute a sampling request; return the command and output path."""
    cmd, out = build_sampling_command(req)
    if req.dry_run:
        return SampleResult(command=cmd, output=out, returncode=0)

    # Ensure asv_tachyon is importable in the target interpreter.
    probe = subprocess.run(
        [req.python, "-c", "import asv_tachyon.driver"],
        capture_output=True,
        text=True,
    )
    if probe.returncode != 0:
        raise TachyonError(
            f"Target Python {req.python} cannot import asv_tachyon.driver.\n"
            "Install asv-tachyon into the benchmark environment, e.g.\n"
            f"  {req.python} -m pip install asv-tachyon\n"
            "or add pip+asv-tachyon to the asv.conf.json matrix.\n"
            f"{(probe.stderr or probe.stdout).strip()}"
        )

    print("asv-tachyon:", " ".join(shlex.quote(c) for c in cmd), file=sys.stderr)
    completed = subprocess.run(cmd)
    return SampleResult(
        command=cmd, output=out, returncode=completed.returncode
    )


def replay_binary(
    python: str,
    binary: Path,
    *,
    fmt: FormatName = "flamegraph",
    output: Path | None = None,
    browser: bool = False,
    baseline: Path | None = None,
    dry_run: bool = False,
) -> SampleResult:
    """Replay a Tachyon binary capture into another format."""
    require_sampling_python(python)
    binary = Path(binary).resolve()
    if not binary.exists():
        raise TachyonError(f"Binary profile not found: {binary}")

    cmd: list[str] = [python, "-m", "profiling.sampling", "replay"]
    if fmt == "diff-flamegraph":
        raise TachyonError(
            "Use `asv-tachyon sample --format diff-flamegraph --baseline ...` "
            "for differential flame graphs (needs a live run)."
        )
    cmd.append(FORMAT_FLAGS[fmt])
    if output is not None:
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        cmd.extend(["-o", str(output)])
    if browser:
        cmd.append("--browser")
    cmd.append(str(binary))

    if dry_run:
        return SampleResult(command=cmd, output=output, returncode=0)

    print("asv-tachyon:", " ".join(shlex.quote(c) for c in cmd), file=sys.stderr)
    completed = subprocess.run(cmd)
    return SampleResult(command=cmd, output=output, returncode=completed.returncode)
