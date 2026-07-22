"""ASV ProfilerGui adapters for HTML profile artifacts.

Register by listing ``asv_tachyon`` (or ``asv_tachyon.plugin``) in
``asv.conf.json`` ``plugins``, then::

    asv profile --gui=tachyon ...

``asv profile`` still *collects* cProfile dumps. Sampling metrics and
flame-graph artifacts come from the separate packages:

* **asv_bench_tachyon** — ``sample_*`` metrics + Tachyon HTML profiles
* **asv_bench_memray** — ``ray_*`` peak memory + memray HTML reports

Those plugins write under ``.asv/profiles/`` and publish into
``profiles.json`` so the asv-tachyon Explore view can open them.
"""

from __future__ import annotations

import marshal
from pathlib import Path

from asv_tachyon.util import TachyonError, open_path

try:
    from asv.asv_profiling import ProfilerGui as _ProfilerGui
except ImportError:  # pragma: no cover - unit tests without asv installed
    class _ProfilerGui:  # type: ignore[no-redef]
        name = ""
        description = ""

        @classmethod
        def is_available(cls) -> bool:
            return False

        @classmethod
        def open_profiler_gui(cls, profiler_file: str):
            raise RuntimeError("asv is required for ProfilerGui")


def _looks_like_cprofile(path: Path) -> bool:
    """Heuristic: cProfile dumps start with a marshal'd dict of stats."""
    try:
        data = path.read_bytes()
    except OSError:
        return False
    if len(data) < 4:
        return False
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


class TachyonGui(_ProfilerGui):
    """Open HTML profile reports; guide users for cProfile dumps."""

    name = "tachyon"
    description = (
        "Open HTML profile artifacts (Tachyon flame graphs, memray reports). "
        "Metrics: asv_bench_tachyon / asv_bench_memray."
    )

    @classmethod
    def is_available(cls) -> bool:
        return True

    @classmethod
    def open_profiler_gui(cls, profiler_file: str):
        path = Path(profiler_file)
        if not path.exists():
            raise TachyonError(f"Profile file not found: {path}")

        if _looks_like_html(path) or path.is_dir():
            open_path(path)
            return 0

        if _looks_like_cprofile(path):
            msg = (
                "asv profile produced a cProfile dump, which this GUI does not open.\n"
                "\n"
                "For sampling *metrics* and flame graphs in the results UI:\n"
                "  pip install asv_bench_tachyon   # sample_* + Tachyon HTML\n"
                "  pip install asv_bench_memray    # ray_* + memray HTML\n"
                "\n"
                "Both plugins can save profile HTML under .asv/profiles/ and publish\n"
                "into profiles.json for asv-tachyon Explore \"Open profile\".\n"
                "\n"
                "For interactive cProfile GUIs keep using snakeviz:\n"
                "  asv profile --gui=snakeviz <benchmark>\n"
            )
            try:
                from asv import util as asv_util

                raise asv_util.UserError(msg)
            except ImportError:
                raise TachyonError(msg) from None

        try:
            open_path(path)
            return 0
        except TachyonError as exc:
            try:
                from asv import util as asv_util

                raise asv_util.UserError(str(exc)) from exc
            except ImportError:
                raise


class FlamegraphGui(TachyonGui):
    """Alias so ``--gui=flamegraph`` also works after plugin load."""

    name = "flamegraph"
    description = "Alias for --gui=tachyon (HTML profile viewer)"
