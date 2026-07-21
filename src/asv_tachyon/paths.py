"""Graph path helpers matching asv.graph.Graph.get_file_path / asv.js."""

from __future__ import annotations

import re
from urllib.parse import quote


def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)


def graph_to_path(benchmark_name: str, state: dict[str, str | None]) -> str:
    parts: list[str] = []
    for key, value in state.items():
        if value is None:
            part = f"{key}-null"
        elif value:
            part = f"{key}-{value}"
        else:
            part = key
        parts.append(sanitize_filename(part))
    parts.sort()
    parts.insert(0, "graphs")
    parts.append(sanitize_filename(benchmark_name))
    return "/".join(quote(p, safe="") for p in parts) + ".json"
