"""Shared helpers for asv-tachyon (UI package)."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


class TachyonError(RuntimeError):
    """User-facing error from asv-tachyon."""


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
