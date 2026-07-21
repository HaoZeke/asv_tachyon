"""ASV conf plugin entry.

In ``asv.conf.json``::

    "plugins": ["asv_tachyon.plugin"]

Importing this module (or calling :func:`setup`) registers Tachyon
:class:`~asv.asv_profiling.ProfilerGui` subclasses for
``asv profile --gui=list``.
"""

from __future__ import annotations


def setup() -> None:
    from asv_tachyon import gui  # noqa: F401


# Import on load so conf plugin lists work without an explicit setup() call.
setup()
