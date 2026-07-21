asv-tachyon
===========

**Modern web UI for airspeed velocity results.**

Drop-in shell over the same static tree ``asv publish`` already writes
(``index.json``, ``graphs/**``, ``regressions.json``). No server-side app,
no new result format.

.. raw:: html

   <p>
     <img class="hero-shot" src="_static/overview.jpg"
          alt="asv-tachyon Overview — performance atlas with sparklines"
          width="100%" />
   </p>
   <p style="text-align:center;opacity:0.75"><em>Overview — sparkline tiles over published ASV graphs</em></p>

Install
-------

.. code-block:: bash

   pip install asv-tachyon
   asv publish
   asv-tachyon serve .asv/html --open

Or replace the legacy ``index.html`` in place:

.. code-block:: bash

   asv-tachyon install .asv/html
   asv-tachyon serve .asv/html

Demo without a project:

.. code-block:: bash

   asv-tachyon serve fixtures/sample_site --open

Views
-----

.. raw:: html

   <div class="gallery">
     <figure>
       <img src="_static/compare.jpg" alt="Compare view" />
       <figcaption><strong>Compare</strong> — spyglass-style Before / After / Ratio</figcaption>
     </figure>
     <figure>
       <img src="_static/inventory.jpg" alt="Inventory view" />
       <figcaption><strong>Inventory</strong> — SBOM-style env lock diffs</figcaption>
     </figure>
   </div>

* **Overview** — fluid sparkline atlas, search, light/dark themes
* **Explore** — full uPlot series, recent points, source snippet
* **Compare** — pairwise ratios with the same factor semantics as
  ``asv compare`` / asv-spyglass (env or revision pairs)
* **Inventory** — added / removed / version-bumped over published params
  or two dropped ASV result JSON files (same classify as
  ``asv-spyglass env-diff``)

Ecosystem
---------

====================  =======================================================
Tool                  Job
====================  =======================================================
**asv**               run benchmarks, write results, ``asv publish``
**asv-tachyon**       modern UI over that published tree
**asv-spyglass**      CLI compare + SBOM-style ``env-diff`` on result files
**asv-perch**         PR comment tables (CI)
**asv_bench_tachyon** ``sample_*`` metric plugin (separate package)
====================  =======================================================

.. toctree::
   :maxdepth: 2
   :hidden:

   usage
   views

Indices
-------

* :ref:`genindex`
* :ref:`search`
