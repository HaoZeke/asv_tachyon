"""Command-line interface for asv-tachyon."""

from __future__ import annotations

import os
from pathlib import Path

import click

from asv_tachyon import __version__
from asv_tachyon.sample import (
    FORMAT_FLAGS,
    SampleRequest,
    replay_binary,
    run_sample,
)
from asv_tachyon.util import (
    TachyonError,
    open_path,
    require_sampling_python,
    which_python,
)

FORMATS = tuple(FORMAT_FLAGS.keys())


def _die(msg: str, code: int = 1) -> None:
    click.echo(f"error: {msg}", err=True)
    raise SystemExit(code)


def _load_asv_conf(config: str | None):
    from asv import config as asv_config

    conf_path = config
    if conf_path is None:
        for candidate in ("asv.conf.json", "asv.conf.yaml"):
            if Path(candidate).exists():
                conf_path = candidate
                break
    if conf_path is None:
        return None
    conf_path = os.path.abspath(conf_path)
    os.chdir(os.path.dirname(conf_path))
    return asv_config.Config.load(conf_path)


def _resolve_python(python: str | None, env_spec: str | None, conf) -> str:
    if python:
        return which_python(python)

    if env_spec and env_spec.startswith("existing:"):
        return which_python(env_spec.split(":", 1)[1])

    if conf is not None:
        try:
            from asv.environment import get_environments

            envs = list(get_environments(conf, env_spec))
            # Prefer an env whose python is 3.15+.
            for env in envs:
                py = getattr(env, "python", None) or getattr(env, "_python", None)
                # ExistingEnvironment exposes executable via get_executable-ish APIs
                exe = None
                if hasattr(env, "_executable"):
                    exe = env._executable
                if hasattr(env, "get_executable"):
                    try:
                        exe = env.get_executable()  # type: ignore[misc]
                    except Exception:
                        pass
                if exe is None and hasattr(env, "_path"):
                    # virtualenv layout
                    cand = Path(env._path) / "bin" / "python"
                    if cand.exists():
                        exe = str(cand)
                if exe:
                    try:
                        require_sampling_python(str(exe))
                        return str(exe)
                    except TachyonError:
                        continue
        except Exception as exc:
            click.echo(f"warning: could not resolve asv environments: {exc}", err=True)

    # Fall back to current interpreter.
    return which_python(None)


def _benchmark_dir(conf, explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    if conf is not None and getattr(conf, "benchmark_dir", None):
        return Path(conf.benchmark_dir).resolve()
    for candidate in ("benchmarks", "benchmark"):
        if Path(candidate).is_dir():
            return Path(candidate).resolve()
    _die(
        "Could not find benchmarks directory. Pass --benchmark-dir or run "
        "inside an ASV project with asv.conf.json."
    )


@click.group()
@click.version_option(__version__, prog_name="asv-tachyon")
def cli() -> None:
    """Sample ASV benchmarks with Python 3.15 Tachyon (profiling.sampling)."""


@cli.command("sample")
@click.argument("benchmark")
@click.option("--config", default=None, help="Path to asv.conf.json")
@click.option(
    "--benchmark-dir",
    "benchmark_dir",
    default=None,
    help="Benchmarks package directory (default: from conf or ./benchmarks)",
)
@click.option(
    "--python",
    "python_exe",
    default=None,
    help="Target Python 3.15+ executable used for sampling",
)
@click.option(
    "-E",
    "--env-spec",
    default=None,
    help="ASV environment selector (e.g. existing:/path/to/python)",
)
@click.option(
    "--format",
    "fmt",
    type=click.Choice(FORMATS),
    default="flamegraph",
    show_default=True,
    help="Tachyon output format",
)
@click.option("-o", "--output", type=click.Path(), default=None, help="Output path")
@click.option(
    "--mode",
    type=click.Choice(["wall", "cpu", "gil", "exception"]),
    default="wall",
    show_default=True,
)
@click.option("-r", "--rate", default="1khz", show_default=True, help="Sampling rate")
@click.option(
    "--duration",
    type=float,
    default=None,
    help="Seconds to run the benchmark loop (driver-side)",
)
@click.option("--loops", type=int, default=None, help="Fixed driver iteration count")
@click.option("--warmup", type=int, default=1, show_default=True)
@click.option("-a", "--all-threads", is_flag=True, help="Sample all threads")
@click.option("--native", is_flag=True, help="Insert <native> frames")
@click.option("--opcodes", is_flag=True, help="Record bytecode opcodes")
@click.option("--async-aware", is_flag=True, help="Asyncio task stacks")
@click.option(
    "--async-mode",
    type=click.Choice(["running", "all"]),
    default=None,
)
@click.option("--no-gc", is_flag=True, help="Omit <GC> frames")
@click.option("--subprocesses", is_flag=True, help="Follow subprocesses")
@click.option("--blocking", is_flag=True, help="Freeze threads while sampling")
@click.option("--live", is_flag=True, help="Live top-like TUI")
@click.option("--browser", is_flag=True, help="Open HTML output in a browser")
@click.option(
    "--baseline",
    type=click.Path(exists=True),
    default=None,
    help="Baseline .bin for --format diff-flamegraph",
)
@click.option(
    "--compression",
    type=click.Choice(["auto", "zstd", "none"]),
    default=None,
)
@click.option("--sort", default=None, help="pstats sort key")
@click.option("-l", "--limit", type=int, default=None, help="pstats row limit")
@click.option("--no-summary", is_flag=True)
@click.option("--dry-run", is_flag=True, help="Print command and exit")
def sample_cmd(
    benchmark,
    config,
    benchmark_dir,
    python_exe,
    env_spec,
    fmt,
    output,
    mode,
    rate,
    duration,
    loops,
    warmup,
    all_threads,
    native,
    opcodes,
    async_aware,
    async_mode,
    no_gc,
    subprocesses,
    blocking,
    live,
    browser,
    baseline,
    compression,
    sort,
    limit,
    no_summary,
    dry_run,
):
    """Sample BENCHMARK with Tachyon and write a profile artifact."""
    try:
        conf = _load_asv_conf(config)
        py = _resolve_python(python_exe, env_spec, conf)
        bdir = _benchmark_dir(conf, benchmark_dir)
        results_dir = Path(conf.results_dir) if conf and conf.results_dir else None
        req = SampleRequest(
            benchmark=benchmark,
            benchmark_dir=bdir,
            python=py,
            output=Path(output) if output else None,
            fmt=fmt,
            mode=mode,
            rate=rate,
            duration=duration,
            loops=loops,
            warmup=warmup,
            all_threads=all_threads,
            native=native,
            opcodes=opcodes,
            async_aware=async_aware,
            async_mode=async_mode,
            no_gc=no_gc,
            subprocesses=subprocesses,
            blocking=blocking,
            live=live,
            browser=browser,
            sort=sort,
            limit=limit,
            no_summary=no_summary,
            baseline=Path(baseline) if baseline else None,
            compression=compression,
            conf_results_dir=results_dir,
            dry_run=dry_run,
        )
        result = run_sample(req)
    except TachyonError as exc:
        _die(str(exc))
    except Exception as exc:
        _die(f"{type(exc).__name__}: {exc}")

    if dry_run:
        click.echo(" ".join(result.command))
        return

    if result.returncode != 0:
        raise SystemExit(result.returncode)
    if result.output is not None:
        click.echo(f"Wrote {result.output}")


@cli.command("open")
@click.argument("path", type=click.Path(exists=True))
def open_cmd(path):
    """Open a flame graph, heatmap directory, or other Tachyon artifact."""
    try:
        open_path(Path(path))
    except TachyonError as exc:
        _die(str(exc))


@cli.command("replay")
@click.argument("binary", type=click.Path(exists=True))
@click.option(
    "--python",
    "python_exe",
    default=None,
    help="Python 3.15+ used for replay (default: current)",
)
@click.option(
    "--format",
    "fmt",
    type=click.Choice([f for f in FORMATS if f != "diff-flamegraph"]),
    default="flamegraph",
    show_default=True,
)
@click.option("-o", "--output", type=click.Path(), default=None)
@click.option("--browser", is_flag=True)
@click.option("--dry-run", is_flag=True)
def replay_cmd(binary, python_exe, fmt, output, browser, dry_run):
    """Replay a Tachyon binary capture into another format."""
    try:
        py = which_python(python_exe)
        result = replay_binary(
            py,
            Path(binary),
            fmt=fmt,
            output=Path(output) if output else None,
            browser=browser,
            dry_run=dry_run,
        )
    except TachyonError as exc:
        _die(str(exc))

    if dry_run:
        click.echo(" ".join(result.command))
        return
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    if result.output is not None:
        click.echo(f"Wrote {result.output}")


@cli.command("doctor")
@click.option("--python", "python_exe", default=None)
@click.option("--config", default=None)
@click.option("-E", "--env-spec", default=None)
def doctor_cmd(python_exe, config, env_spec):
    """Check that Tachyon sampling is available for the target Python."""
    conf = None
    try:
        conf = _load_asv_conf(config)
    except Exception as exc:
        click.echo(f"conf: not loaded ({exc})")
    else:
        click.echo(f"conf: {getattr(conf, 'project', None) or 'loaded'}")

    try:
        py = _resolve_python(python_exe, env_spec, conf)
        ver = require_sampling_python(py)
        click.echo(f"python: {py}")
        click.echo(f"version: {ver[0]}.{ver[1]}.{ver[2]}")
        click.echo("profiling.sampling: ok")
    except TachyonError as exc:
        click.echo(f"profiling.sampling: FAIL\n{exc}")
        raise SystemExit(1)

    probe = __import__("subprocess").run(
        [py, "-c", "import asv_tachyon, asv_runner; print(asv_tachyon.__version__)"],
        capture_output=True,
        text=True,
    )
    if probe.returncode == 0:
        click.echo(f"asv_tachyon in target: {probe.stdout.strip()}")
    else:
        click.echo(
            "asv_tachyon in target: MISSING (pip install asv-tachyon into the env)"
        )


@cli.command("formats")
def formats_cmd():
    """List supported Tachyon output formats."""
    for name in FORMATS:
        click.echo(f"{name:16} flag={FORMAT_FLAGS[name]}")


if __name__ == "__main__":
    cli()
