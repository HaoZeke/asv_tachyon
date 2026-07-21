"""Driver unit tests with a synthetic mini benchmark package."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from asv_tachyon.driver import run_loop


@pytest.fixture
def mini_bench(tmp_path, monkeypatch):
    root = tmp_path / "proj"
    bdir = root / "benchmarks"
    bdir.mkdir(parents=True)
    (bdir / "__init__.py").write_text("")
    (bdir / "bench.py").write_text(
        textwrap.dedent(
            """
            class Suite:
                def time_add(self):
                    return 1 + 1
            """
        )
    )
    monkeypatch.syspath_prepend(str(root))
    return bdir


def test_run_loop_fixed_iterations(mini_bench):
    # asv_runner must be importable in the host test env
    pytest.importorskip("asv_runner")
    rc = run_loop(
        str(mini_bench),
        "benchmarks.Suite.time_add",
        loops=3,
        warmup=0,
    )
    assert rc == 0
