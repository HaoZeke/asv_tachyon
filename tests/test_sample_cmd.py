"""Unit tests that do not require a live Python 3.15 sampling run."""

from __future__ import annotations

from pathlib import Path

import pytest

from asv_tachyon.sample import SampleRequest, build_sampling_command
from asv_tachyon.util import TachyonError, sanitize_name


def test_sanitize_name():
    assert sanitize_name("bench.TimeSuite.time_keys(10)") == "bench.TimeSuite.time_keys_10_"


def test_build_command_flamegraph(tmp_path, monkeypatch):
    py = tmp_path / "python3.15"
    py.write_text("#!/bin/sh\n")
    py.chmod(0o755)

    # Bypass real version probe.
    monkeypatch.setattr(
        "asv_tachyon.sample.require_sampling_python",
        lambda _p: (3, 15, 0),
    )

    req = SampleRequest(
        benchmark="benchmarks.TimeSuite.time_keys-0",
        benchmark_dir=tmp_path / "benchmarks",
        python=str(py),
        output=tmp_path / "out.html",
        fmt="flamegraph",
        mode="cpu",
        rate="500hz",
        all_threads=True,
        native=True,
        loops=10,
    )
    (tmp_path / "benchmarks").mkdir()
    cmd, out = build_sampling_command(req)
    assert cmd[0] == str(py)
    assert cmd[1:4] == ["-m", "profiling.sampling", "run"]
    assert "--flamegraph" in cmd
    assert "-o" in cmd
    assert str(tmp_path / "out.html") in cmd
    assert "--mode" in cmd and "cpu" in cmd
    assert "--all-threads" in cmd
    assert "--native" in cmd
    # Target module + separator + driver args
    m_idx = cmd.index("-m")
    # first -m is profiling.sampling; second is driver
    m_positions = [i for i, c in enumerate(cmd) if c == "-m"]
    assert len(m_positions) >= 2
    assert cmd[m_positions[-1] + 1] == "asv_tachyon.driver"
    assert "--" in cmd
    assert "--benchmark-dir" in cmd
    assert "--name" in cmd
    assert "benchmarks.TimeSuite.time_keys-0" in cmd
    assert "--loops" in cmd and "10" in cmd
    assert out == tmp_path / "out.html"


def test_diff_requires_baseline(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "asv_tachyon.sample.require_sampling_python",
        lambda _p: (3, 15, 0),
    )
    req = SampleRequest(
        benchmark="b.time_x",
        benchmark_dir=tmp_path,
        python="python",
        fmt="diff-flamegraph",
        baseline=None,
    )
    with pytest.raises(TachyonError, match="baseline"):
        build_sampling_command(req)


def test_default_output_under_asv(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "asv_tachyon.sample.require_sampling_python",
        lambda _p: (3, 15, 0),
    )
    monkeypatch.chdir(tmp_path)
    results = tmp_path / ".asv" / "results"
    results.mkdir(parents=True)
    req = SampleRequest(
        benchmark="pkg.time_foo",
        benchmark_dir=tmp_path / "benchmarks",
        python="python",
        fmt="binary",
        conf_results_dir=results,
    )
    (tmp_path / "benchmarks").mkdir()
    cmd, out = build_sampling_command(req)
    assert out is not None
    assert out.parent.name == "tachyon"
    assert out.suffix == ".bin"
    assert "--binary" in cmd
