from pathlib import Path

import pytest

from asv_tachyon.util import TachyonError, parse_loops, require_sampling_python


def test_parse_loops():
    assert parse_loops(None) is None
    assert parse_loops(5) == 5
    with pytest.raises(TachyonError):
        parse_loops(0)


def test_require_sampling_python_rejects_old(monkeypatch):
    monkeypatch.setattr(
        "asv_tachyon.util.python_version_tuple",
        lambda _p: (3, 14, 0),
    )
    with pytest.raises(TachyonError, match="3.15"):
        require_sampling_python("python3.14")


def test_which_python_keeps_venv_path(tmp_path):
    from asv_tachyon.util import which_python
    fake = tmp_path / ".venv" / "bin" / "python"
    fake.parent.mkdir(parents=True)
    fake.write_text("#!/bin/sh\n")
    fake.chmod(0o755)
    got = which_python(str(fake))
    assert got.endswith(".venv/bin/python")
    assert "asv_tachyon" not in got or str(tmp_path) in got
