Views
=====

Overview
--------

Sparkline tiles for every benchmark, filtered by the published ``params``
(machine, branch, python, …). Search matches name or type.

.. image:: _static/overview.jpg
   :alt: Overview view
   :class: hero-shot
   :width: 100%

Compare
-------

Spyglass-style pairwise table: **Change · Before · After · Ratio · Benchmark**.
Modes:

* **Env pair** — two selector states (e.g. python 3.12 vs 3.13)
* **Revision pair** — two commits on one env surface

Factor default is ``1.1`` (same idea as ``asv compare``). Click a row for an
overlay chart of both series.

.. image:: _static/compare.jpg
   :alt: Compare view
   :class: hero-shot
   :width: 100%

Inventory
---------

SBOM-style lock surface (mirrors ``asv-spyglass env-diff`` / eb-stack
``stack_diff``):

* **Published envs** — diff ``params`` + machine facts from ``index.json``
* **Result files** — drop two raw ASV result JSON files for the full
  requirements matrix

Classifies each component as *added*, *removed*, *version-bumped*, or
*unchanged*, with KPI cards and a stacked mix bar.

.. image:: _static/inventory.jpg
   :alt: Inventory view
   :class: hero-shot
   :width: 100%

.. image:: _static/inventory-all-kinds.jpg
   :alt: Inventory with all kinds
   :class: hero-shot
   :width: 100%

*All kinds* also surfaces env name and machine attributes when they differ.
