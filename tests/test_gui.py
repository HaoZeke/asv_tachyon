import marshal
from pathlib import Path

from asv_tachyon.gui import _looks_like_cprofile, _looks_like_html


def test_looks_like_cprofile(tmp_path):
    p = tmp_path / "prof"
    p.write_bytes(marshal.dumps({("a", 1, "b"): (1, 2, 3, 4)}))
    assert _looks_like_cprofile(p)


def test_looks_like_html(tmp_path):
    p = tmp_path / "fg.html"
    p.write_text("<!DOCTYPE html><html></html>")
    assert _looks_like_html(p)
    d = tmp_path / "heatmap"
    d.mkdir()
    (d / "index.html").write_text("<html></html>")
    assert _looks_like_html(d)
