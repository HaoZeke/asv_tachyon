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

## Ecosystem

| Tool | Job |
|------|-----|
| **asv** | run benchmarks, write results, `asv publish` |
| **asv-tachyon** | modern UI over that published tree (`serve` / `install`) |
| **asv-spyglass** | CLI compare + SBOM-style `env-diff` on result files |
| **asv-perch** | PR comment tables (CI) |
| **[asv_bench_tachyon](https://github.com/HaoZeke/asv_bench_tachyon)** | `sample_*` sampling metrics + Tachyon flamegraph HTML → `profiles.json` |
| **[asv_bench_memray](https://github.com/HaoZeke/asv_bench_memray)** | `ray_*` peak-memory metrics + memray HTML → `profiles.json` |

This package is **not** a sampling CLI. Profile *collection* lives in the
`asv_bench_*` metric plugins; this UI only *displays* published sidecars.

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

Open Explore → select `sample_hot_path` or `ray_alloc` → **Open profile**.

## Profile sidecars (`profiles.json`)

Explore shows **Open profile** when `profiles.json` maps the selected
benchmark to a static HTML path. Metric plugins publish into that file:

```bash
# during asv run (optional env or per-bench attributes)
ASV_BENCH_TACHYON_PROFILE=1 asv run --bench sample_
ASV_BENCH_MEMRAY_PROFILE=1 asv run --bench ray_

asv publish
python -m asv_bench_tachyon profiles publish --html-dir .asv/html
python -m asv_bench_memray profiles publish --html-dir .asv/html
asv-tachyon serve .asv/html --open
```

| File | Role |
|------|------|
| `profiles.json` | `{ "paths": { "<bench>@<rev>": "profiles/…/x.html" } }` |
| `profiles/tachyon/` | HTML from asv_bench_tachyon |
| `profiles/memray/` | HTML from asv_bench_memray |
| `commits.json` | commit subjects for chart tooltips |
| Extended graph points | `[rev, { "v", "lo"?, "hi"?, "samples"? }]` |

## What you get

- **Overview** — virtualized sparkline atlas, type/machine filter chips
- **Explore** — uPlot with CI bands, distribution panel, **Open profile**
- **Heatmap / Grid / Multiples / Compare / Regressions / Inventory**
- Same data contract as the stock ASV site — see
  [docs/source/data-contract.rst](docs/source/data-contract.rst)

## Optional ASV GUI plugin

```json
{ "plugins": ["asv_tachyon.plugin"] }
```

```bash
asv profile --gui=tachyon path/to/report.html
```

Opens HTML artifacts only. For cProfile dumps, use snakeviz or collect
profiles via `asv_bench_tachyon` / `asv_bench_memray`.

## License

MIT. See `LICENSE`.
