"""asv-tachyon: Tachyon sampling profiles for Airspeed Velocity benchmarks."""

from __future__ import annotations

try:
    from asv_tachyon._version import __version__
except ImportError:  # pragma: no cover - editable without hatch-vcs write
    __version__ = "0.0.0+unknown"

__all__ = ["__version__", "setup"]


def setup() -> None:
    """ASV conf plugin hook: register Tachyon profiler GUIs."""
    # Importing gui registers ProfilerGui subclasses for iter_subclasses.
    from asv_tachyon import gui  # noqa: F401
