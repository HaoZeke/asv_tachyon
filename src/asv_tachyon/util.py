"""Shared helpers for asv-tachyon."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


MIN_SAMPLE_PYTHON = (3, 15)

_RATE_RE = re.compile(
    r"^(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>hz|khz|k)?$",
    re.IGNORECASE,
)


class TachyonError(RuntimeError):
    """User-facing error from asv-tachyon."""


def which_python(path: str | Path | None = None) -> str:
    """Return a Python executable path without collapsing venv symlinks.

    ``Path.resolve()`` follows ``.venv/bin/python`` to the base interpreter and
    drops site-packages from that venv. Keep the user-facing path absolute but
    do not fully resolve symlinks.
    """
    if path is None:
        return sys.executable
    p = Path(path)
    if not p.is_absolute():
        p = Path.cwd() / p
    # absolute() does not follow symlinks (unlike resolve()).
    return str(p.absolute())


def python_version_tuple(python: str) -> tuple[int, int, int]:
    out = subprocess.check_output(
        [python, "-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"],
        text=True,
    ).strip()
    major, minor, micro = (int(x) for x in out.split("."))
    return major, minor, micro


def require_sampling_python(python: str) -> tuple[int, int, int]:
    version = python_version_tuple(python)
    if version[:2] < MIN_SAMPLE_PYTHON:
        raise TachyonError(
            f"Tachyon sampling needs Python >= 3.15 in the target environment "
            f"(got {version[0]}.{version[1]}.{version[2]} from {python}). "
            "Point asv-tachyon at a 3.15+ env with --python / -E existing:PATH, "
            "or add a 3.15 matrix entry in asv.conf.json."
        )
    # Confirm the stdlib module is importable (alpha builds may lag).
    probe = subprocess.run(
        [python, "-c", "import profiling.sampling"],
        capture_output=True,
        text=True,
    )
    if probe.returncode != 0:
        err = (probe.stderr or probe.stdout or "").strip()
        raise TachyonError(
            f"{python} cannot import profiling.sampling "
            f"(required for Tachyon).\n{err}"
        )
    return version


def sanitize_name(name: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", name)


def default_output_dir(conf_results_dir: str | Path | None = None) -> Path:
    if conf_results_dir is not None:
        base = Path(conf_results_dir).parent
    else:
        base = Path(".asv")
    out = base / "tachyon"
    out.mkdir(parents=True, exist_ok=True)
    return out


def open_path(path: Path) -> None:
    """Open an HTML report or reveal a path in the platform browser/file manager."""
    path = path.resolve()
    if not path.exists():
        raise TachyonError(f"No such path: {path}")

    if path.is_dir():
        index = path / "index.html"
        target = index if index.exists() else path
    else:
        target = path

    if target.suffix.lower() in {".html", ".htm"} or target.name == "index.html":
        import webbrowser

        webbrowser.open(target.as_uri())
        return

    # Fall back to OS open for other artifacts.
    if sys.platform == "darwin":
        subprocess.check_call(["open", str(target)])
    elif os.name == "nt":
        os.startfile(str(target))  # type: ignore[attr-defined]
    else:
        opener = shutil.which("xdg-open")
        if opener:
            subprocess.check_call([opener, str(target)])
        else:
            raise TachyonError(
                f"Cannot open {target}; no xdg-open and not an HTML report."
            )


def parse_loops(value: str | int | None) -> int | None:
    if value is None:
        return None
    n = int(value)
    if n < 1:
        raise TachyonError("--loops must be >= 1")
    return n
