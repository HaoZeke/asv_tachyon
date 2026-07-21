"""Modern web UI for airspeed velocity (ASV) published results."""

try:
    from asv_tachyon._version import __version__
except ImportError:  # pragma: no cover
    __version__ = "0.0.0+unknown"

__all__ = ["__version__"]
