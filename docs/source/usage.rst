Usage
=====

Serve
-----

.. code-block:: bash

   asv-tachyon serve [.asv/html] [--host 127.0.0.1] [-p 8765] [--open]

Serves the modern SPA shell over an ``asv publish`` output directory.
``index.json`` and ``graphs/**`` stay on the data tree; the UI assets are
loaded from the installed package.

Install into html_dir
---------------------

.. code-block:: bash

   asv-tachyon install .asv/html [--no-backup]

Copies ``index.html`` + ``assets/`` into the publish directory (optionally
keeping ``index.legacy.html``). Host with any static server afterward.

Sample site
-----------

The repository ships ``fixtures/sample_site`` with synthetic graphs so you
can try every view without running benchmarks:

.. code-block:: bash

   asv-tachyon serve fixtures/sample_site --open
