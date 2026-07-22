Data contract
=============

asv-tachyon is a **static shell** over the tree ``asv publish`` already writes.
Adapters (pytest-benchmark exporters, custom CI publishers, alternate runners)
only need to emit the same shapes. No server-side API, no second result format.

Layout
------

::

   html_dir/
     index.json          # required — project atlas
     graphs/             # required — one JSON series per bench × env
       <param-key>-<value>/.../<benchmark>.json
     regressions.json    # optional — regression feed
     regressions.xml     # optional — Atom feed (stock ASV; ignored by UI)
     info.json           # optional — publish metadata
     profiles.json       # optional — Explore "Open profile" links
     profiles/           # optional — static HTML artifacts referenced above
       tachyon/          # from asv_bench_tachyon
       memray/           # from asv_bench_memray

``asv-tachyon serve html_dir`` overlays the SPA shell (``index.html`` +
``assets/``) while every ``*.json`` / ``graphs/**`` path is still read from
``html_dir``.

``index.json``
--------------

Top-level keys the UI reads:

======================  =========================================================
Key                     Role
======================  =========================================================
``project``             Display name
``project_url``         Optional project link
``show_commit_url``     Optional commit URL prefix (hash is appended)
``hash_length``         Short-hash width (default 8)
``revision_to_hash``    Map ``"revision"`` → full commit hash
``revision_to_date``    Map ``"revision"`` → epoch **milliseconds**
``params``              Matrix axes: ``{ axis: [value, ...] }``
``graph_param_list``    Concrete env states (cartesian subset actually published)
``machines``            Machine facts keyed by machine name
``tags``                Optional ``{ tag: revision }``
``benchmarks``          Map of benchmark name → metadata (see below)
======================  =========================================================

Benchmark metadata (``benchmarks[name]``):

* ``name`` — full name (same as key)
* ``type`` — ``time`` / ``memory`` / ``peakmemory`` / ``track`` / …
* ``unit`` — ``seconds``, ``bytes``, or a free-form unit
* ``params`` — list of parameter axes; each axis is a list of string values
* ``param_names`` — parallel list of axis names
* ``code`` — optional source snippet shown in Explore

Example (truncated)::

   {
     "project": "asv-demo",
     "hash_length": 8,
     "revision_to_hash": { "1": "abc…", "2": "def…" },
     "revision_to_date": { "1": 1700086400000, "2": 1700172800000 },
     "params": {
       "branch": ["main"],
       "machine": ["cheetah"],
       "python": ["3.12", "3.13"]
     },
     "graph_param_list": [
       {"branch": "main", "machine": "cheetah", "python": "3.12"},
       {"branch": "main", "machine": "cheetah", "python": "3.13"}
     ],
     "machines": {
       "cheetah": {"arch": "x86_64", "cpu": "Ryzen 9", "os": "Linux", "ram": "64GB"}
     },
     "tags": {},
     "benchmarks": {
       "time_sort": {
         "name": "time_sort",
         "type": "time",
         "unit": "seconds",
         "params": [],
         "param_names": [],
         "code": "def time_sort():\n    …\n"
       },
       "time_keys": {
         "name": "time_keys",
         "type": "time",
         "unit": "seconds",
         "params": [["10", "100", "1000"]],
         "param_names": ["n"]
       }
     }
   }

Graph path convention
---------------------

For each entry in ``graph_param_list`` and each benchmark name, publish::

   graphs/<axis>-<value>/…/<benchmark>.json

Rules (mirrors stock ASV ``Graph.path``):

1. One directory segment per ``(axis, value)`` pair: ``{axis}-{value}``.
2. Segments are **sorted alphabetically** by the full segment string.
3. Filename is the sanitized benchmark name + ``.json``.
4. Characters ``<>:"/\|?*`` and control chars in names/values become ``_``.

Example for ``branch=main``, ``machine=cheetah``, ``python=3.12``,
benchmark ``time_sort``::

   graphs/branch-main/machine-cheetah/python-3.12/time_sort.json

Graph JSON shape
----------------

A graph file is a **JSON array** of ``[revision, value]`` points:

* ``revision`` — integer key present in ``revision_to_hash``
* ``value`` — one of:

  * ``null`` — missing / failed
  * number — scalar result (no benchmark params, or a single series)
  * array of numbers/null — one entry **per flat param combination**

Parameter flattening matches ASV: for ``params = [["10","100","1000"]]``
(one axis ``n``), the value array has length 3 with indices ``0→n=10``,
``1→n=100``, ``2→n=1000``. Multi-axis params are a row-major cartesian
product; the last axis varies fastest.

Example scalar series::

   [[1, 1.2e-5], [2, 1.21e-5], [3, null], [4, 1.19e-5]]

Example multi-param series (``n ∈ {10,100,1000}``)::

   [
     [1, [1.0e-6, 1.0e-5, 1.0e-4]],
     [2, [1.01e-6, 1.01e-5, 1.01e-4]]
   ]

``regressions.json``
--------------------

Optional. Written by ASV's regressions publisher. Top-level::

   { "regressions": [ entry, … ] }

Each ``entry`` is a 7-tuple:

.. code-block:: text

   [
     entry_name,       # str  — benchmark name, may include "(param=…)" suffix
     graph_path,       # str  — path to the graph JSON (may be relative)
     graph_params,     # object — subset of env axes that vary (or all used)
     param_idx,        # int|null — flat param index, or null if scalar
     last_value,       # number — latest measured value
     best_value,       # number — best value after the detected step
     jumps             # list of [rev_before|null, rev_after, value_before, value_after]
   ]

``factor`` for display is ``last_value / best_value`` (higher means a larger
regression for lower-is-better metrics). The UI filters by a user-controlled
threshold on that factor and links each row into Explore with the env filters
and param index applied.

Example::

   {
     "regressions": [
       [
         "time_sort",
         "graphs/branch-main/machine-cheetah/python-3.12/time_sort.json",
         {"branch": "main", "machine": "cheetah", "python": "3.12"},
         null,
         1.74e-05,
         1.2e-05,
         [[20, 21, 1.25e-05, 1.74e-05]]
       ]
     ]
   }



``profiles.json`` (optional sidecar)
------------------------------------

asv-tachyon Explore shows an **Open profile** link when a key matches the
selected benchmark (prefer ``bench@rev``, fall back to bare ``bench``).

Producers are the **metric plugins**, not this UI package:

* ``asv_bench_tachyon`` — ``sample_*`` metrics + Tachyon flamegraph HTML
* ``asv_bench_memray`` — ``ray_*`` peak memory + memray HTML

Typical flow::

   ASV_BENCH_TACHYON_PROFILE=1 asv run --bench sample_
   ASV_BENCH_MEMRAY_PROFILE=1 asv run --bench ray_
   asv publish
   python -m asv_bench_tachyon profiles publish --html-dir .asv/html
   python -m asv_bench_memray profiles publish --html-dir .asv/html
   asv-tachyon serve .asv/html --open

Shape::

   {
     "paths": {
       "sample_hot_path@30": "profiles/tachyon/sample_hot_path.html",
       "sample_hot_path": "profiles/tachyon/sample_hot_path.html",
       "ray_alloc@30": "profiles/memray/ray_alloc.html"
     }
   }

Paths are relative to ``html_dir`` and must be fetchable as static files.
Both plugins **merge** into the same ``profiles.json`` (last publish wins on
duplicate keys).

Adapter checklist (pytest-benchmark, etc.)
------------------------------------------

1. Emit ``index.json`` with at least ``project``, ``revision_to_hash``,
   ``revision_to_date``, ``params``, ``graph_param_list``, ``benchmarks``.
2. For every ``graph_param_list`` entry × benchmark, write the graph JSON at
   the path convention above.
3. Use revision integers consistently across ``revision_to_*`` and graph
   points.
4. Prefer string param values (ASV stores them as strings in
   ``benchmarks[name].params``).
5. Optionally emit ``regressions.json`` in the 7-tuple form above.
6. Point ``asv-tachyon serve`` at the directory — no further conversion.

The repository ships ``fixtures/sample_site/`` as a minimal valid tree.
