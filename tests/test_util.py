from pathlib import Path

import pytest

from asv_tachyon.util import TachyonError, open_path


def test_open_path_missing(tmp_path):
    with pytest.raises(TachyonError, match="No such path"):
        open_path(tmp_path / "missing.html")


def test_open_path_html_uses_webbrowser(tmp_path, monkeypatch):
    p = tmp_path / "report.html"
    p.write_text("<html></html>")
    opened = []
    monkeypatch.setattr(
        "webbrowser.open", lambda uri: opened.append(uri)
    )
    open_path(p)
    assert opened and opened[0].startswith("file:")
