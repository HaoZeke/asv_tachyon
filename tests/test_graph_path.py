"""Mirror of graph path construction (must match asv.js / asv.graph)."""

from asv_tachyon.paths import graph_to_path, sanitize_filename


def test_sanitize():
    assert "/" not in sanitize_filename("a/b")


def test_graph_path_order():
    p = graph_to_path(
        "time_sort",
        {"python": "3.12", "branch": "main", "machine": "cheetah"},
    )
    # keys sorted alphabetically in path segments
    assert p.startswith("graphs/")
    assert p.endswith("/time_sort.json")
    assert "branch-main" in p
    assert "machine-cheetah" in p
    assert "python-3.12" in p
    # sorted: branch, machine, python
    assert p.index("branch-main") < p.index("machine-cheetah") < p.index("python-3.12")
