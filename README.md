# asv-tachyon

**Modern web UI for [airspeed velocity](https://asv.readthedocs.io/) results.**

ASV’s built-in site is still jQuery + Flot + Bootstrap 3. **asv-tachyon** is a
drop-in shell over the same static data that `asv publish` already writes
(`index.json`, `graphs/**`, `regressions.json`). No server-side app, no new
result format, no second benchmark type.

| Tool | Job |
|------|-----|
| **asv** | run benchmarks, write results, `asv publish` data |
| **asv-tachyon** | modern UI over that published tree |
| **asv-perch** | PR comment tables (CI) |
| **asv_spyglass** | compare two result JSON files + SBOM-style `env-diff` |
| **asv_bench_tachyon** | `sample_*` metric plugin (separate package) |

## Install

```bash
pip install asv-tachyon
# or from git after building the UI once
```

The wheel embeds a prebuilt SPA (`web/dist`). From a checkout:

```bash
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
# then any static host, or:
asv-tachyon serve .asv/html
```

## What you get

- Overview tiles with sparklines, Explore for full charts + source
- Pairwise **Compare** (spyglass-style Before/After/Ratio, env or revision)
- **Inventory** view: SBOM-style env lock diffs (added / removed / version-bumped)
  - over published param surfaces (`index.json` + machines), or
  - by dropping two raw ASV result JSON files (same classify as
    `asv-spyglass env-diff`)
- Light/dark themes, machine / branch / python filters
- Same data contract as the stock ASV site — works with existing published trees

## Development

```bash
# terminal 1: static data
asv-tachyon serve fixtures/sample_site -p 8765

# terminal 2: vite (optional hot reload; proxy configured to :8765)
cd web && npm install && npm run dev
```

## License

MIT.
