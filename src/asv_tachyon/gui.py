"""ASV ProfilerGui adapters for Tachyon HTML/binary artifacts.

Register by listing ``asv_tachyon`` (or ``asv_tachyon.plugin``) in
``asv.conf.json`` ``plugins``, then::

    asv profile --gui=tachyon ...

``asv profile`` still *collects* cProfile dumps. The Tachyon GUI opens
HTML flame graphs / heatmaps when the path is a Tachyon artifact, and
explains how to sample with ``asv-tachyon`` when handed a cProfile dump.
"""

from __future__ import annotations

import marshal
from pathlib import Path

from asv.asv_profiling import ProfilerGui
from asv import util as asv_util

from asv_tachyon.util import TachyonError, open_path


def _looks_like_cprofile(path: Path) -> bool:
    """Heuristic: cProfile dumps start with a marshal'd dict of stats."""
    try:
        data = path.read_bytes()
    except OSError:
        return False
    if len(data) < 4:
        return False
    # pstats/cProfile binary format: marshal of a dict
    try:
        obj = marshal.loads(data)
        return isinstance(obj, dict)
    except Exception:
        return False


def _looks_like_html(path: Path) -> bool:
    if path.suffix.lower() in {".html", ".htm"}:
        return True
    if path.is_dir() and (path / "index.html").exists():
        return True
    try:
        head = path.read_bytes()[:64].lstrip().lower()
    except OSError:
        return False
    return head.startswith(b"<!doctype") or head.startswith(b"<html")


class TachyonGui(ProfilerGui):
    """Open Tachyon HTML reports; guide users for cProfile dumps."""

    name = "tachyon"
    description = (
        "Tachyon (profiling.sampling) flame graphs / heatmaps — "
        "https://docs.python.org/3.15/library/profiling.sampling.html"
    )

    @classmethod
    def is_available(cls) -> bool:
        return True

    @classmethod
    def open_profiler_gui(cls, profiler_file: str):
        path = Path(profiler_file)
        if not path.exists():
            raise TachyonError(f"Profile file not found: {path}")

        if _looks_like_html(path):
            open_path(path)
            return 0

        if path.is_dir():
            open_path(path)
            return 0

        if _looks_like_cprofile(path):
            msg = (
                "asv profile produced a cProfile dump, which Tachyon does not open.\n"
                "\n"
                "Collect a sampling profile instead:\n"
                "  asv-tachyon sample <benchmark> --format flamegraph --browser\n"
                "\n"
                "Or keep using a cProfile GUI:\n"
                "  asv profile --gui=snakeviz <benchmark>\n"
            )
            raise asv_util.UserError(msg)

        # Unknown artifact: try opening as HTML/path anyway.
        try:
            open_path(path)
            return 0
        except TachyonError as exc:
            raise asv_util.UserError(str(exc)) from exc


class FlamegraphGui(TachyonGui):
    """Alias so ``--gui=flamegraph`` also works after plugin load."""

    name = "flamegraph"
    description = "Alias for --gui=tachyon (HTML flame graph / heatmap viewer)"
