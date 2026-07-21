<p align="center">
  <img src="branding/logo/asv_tachyon_logo.png" alt="asv-tachyon" width="120" />
</p>

# asv-tachyon

**Modern web UI for [airspeed velocity](https://asv.readthedocs.io/) results.**

[![PyPI](https://img.shields.io/pypi/v/asv-tachyon.svg)](https://pypi.org/project/asv-tachyon/)
[![Python](https://img.shields.io/pypi/pyversions/asv-tachyon.svg)](https://pypi.org/project/asv-tachyon/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://haozeke.github.io/asv_tachyon/)

ASV’s built-in site is still jQuery + Flot + Bootstrap 3. **asv-tachyon** is a
drop-in shell over the same static data that `asv publish` already writes
(`index.json`, `graphs/**`, `regressions.json`). No server-side app, no new
result format, no second benchmark type.

<p align="center">
  <img src="https://raw.githubusercontent.com/HaoZeke/asv_tachyon/main/docs/images/overview.jpg"
       alt="asv-tachyon Overview — performance atlas with sparklines"
       width="920" />
</p>

<p align="center"><em>Overview — sparkline tiles over published ASV graphs</em></p>

## Gallery

| Compare (spyglass-style ratios) | Inventory (SBOM-style env lock) |
|:---:|:---:|
| <img src="https://raw.githubusercontent.com/HaoZeke/asv_tachyon/main/docs/images/compare.jpg" alt="Compare view" width="440" /> | <img src="https://raw.githubusercontent.com/HaoZeke/asv_tachyon/main/docs/images/inventory.jpg" alt="Inventory view" width="440" /> |
| Env or revision pairs · Before / After / Ratio · factor gate | added · removed · version-bumped · drop result JSON files |

| Tool | Job |
|------|-----|
| **asv** | run benchmarks, write results, `asv publish` data |
| **asv-tachyon** | modern UI over that published tree |
| **asv-spyglass** | CLI compare + SBOM-style `env-diff` on result files |
| **asv-perch** | PR comment tables (CI) |
| **asv_bench_tachyon** | `sample_*` metric plugin (separate package) |

## Install

```bash
pip install asv-tachyon
# or from a checkout after building the UI once
cd web && npm install && npm run build && cd ..
pip install -e .
```

## Usage

```bash
asv run
asv publish
asv-tachyon serve .asv/html --open
```

Or replace the legacy `index.html` in place (keeps all graph JSON):

```bash
asv publish
asv-tachyon install .asv/html
asv-tachyon serve .asv/html
```

Demo without a project:

```bash
asv-tachyon serve fixtures/sample_site --open
```

## What you get

- **Overview** — fluid sparkline atlas, search, light/dark themes
- **Explore** — full uPlot series, param multi-series overlays with stable
  colors, filters preserved across benchmark switches (URL hash shareable)
- **Compare** — multi-env compare-many columns from `graph_param_list`, or
  revision pairs (same factor semantics as `asv compare` / asv-spyglass)
- **Regressions** — `regressions.json` table with interactive factor threshold
- **Inventory** — SBOM-style env lock diffs (added / removed / version-bumped)
  over published `params` + machines, or by dropping two raw result JSON files
- Self-hosted fonts (offline-safe; no Google Fonts CDN)
- Same data contract as the stock ASV site — see
  [docs/source/data-contract.rst](docs/source/data-contract.rst) for
  `index.json` + `graphs/**` + `regressions.json` shapes (adapters /
  pytest-benchmark exporters)

## Development

```bash
# terminal 1: static data
asv-tachyon serve fixtures/sample_site -p 8765

# terminal 2: vite (optional hot reload)
cd web && npm install && npm run dev
```

Docs site (Sphinx + Shibuya):

```bash
pip install -e '.[docs]'
sphinx-build -b html docs/source docs/build/html
```

## License

MIT.
