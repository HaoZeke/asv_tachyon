![asv-tachyon](./branding/logo/asv_tachyon_logo.png)

# asv-tachyon

[![CI](https://github.com/HaoZeke/asv_tachyon/actions/workflows/ci.yml/badge.svg)](https://github.com/HaoZeke/asv_tachyon/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/asv-tachyon.svg)](https://pypi.org/project/asv-tachyon/)
[![Python](https://img.shields.io/pypi/pyversions/asv-tachyon.svg)](https://pypi.org/project/asv-tachyon/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Near-zero-overhead [Tachyon](https://docs.python.org/3.15/library/profiling.sampling.html) sampling profiles for [Airspeed Velocity](https://asv.readthedocs.io/) benchmarks.

Python 3.15 ships `profiling.sampling` (code-named **Tachyon**): an external statistical sampler that reads a process's call stack from outside, so the benchmark runs at full speed. **asv-tachyon** wires that sampler into ASV projects — flame graphs, heatmaps, gecko/Firefox Profiler exports, binary captures you can replay and diff, and an `asv profile --gui=tachyon` hook.

## Why

ASV's built-in `asv profile` path still uses deterministic `cProfile`. That is exact, but expensive, and it distorts cheap functions. Tachyon samples from a sibling process, so:

- long benchmarks and production-like workloads keep realistic timings
- wall / CPU / GIL / exception **modes** separate waiting from working
- `--all-threads` and `--async-aware` cover real concurrency
- outputs include interactive flame graphs and line-level heatmaps

## Install

```bash
pip install asv-tachyon
# or
uv pip install asv-tachyon
```

Sampling itself needs a *target* interpreter with Python >= 3.15 (the host CLI runs on 3.10+). Install the package into the same environment ASV uses for the benchmark, for example via the matrix:

```json
{
  "matrix": {
    "req": {
      "pip+asv-tachyon": [""]
    }
  },
  "plugins": ["asv_tachyon.plugin"]
}
```

## Quick start

From an ASV project root (with `asv.conf.json` and `benchmarks/`):

```bash
# Flame graph for one benchmark (parameterized names use ASV's -N suffix)
asv-tachyon sample benchmarks.TimeSuite.time_keys-0 --browser

# CPU-only, all threads, binary capture for later replay
asv-tachyon sample benchmarks.TimeSuite.time_keys-0 \
  --mode cpu --all-threads --format binary -o slow.tachyon.bin

# Replay binary -> heatmap
asv-tachyon replay slow.tachyon.bin --format heatmap -o heat --browser

# Differential flame graph after a fix
asv-tachyon sample benchmarks.TimeSuite.time_keys-0 \
  --format diff-flamegraph --baseline slow.tachyon.bin -o diff.html --browser

# Sanity-check the target interpreter
asv-tachyon doctor --python "$(which python3.15)"
```

Point at a specific 3.15 environment:

```bash
asv-tachyon sample benchmarks.TimeSuite.time_keys-0 \
  -E "existing:$(pwd)/.asv/env/venv-py3.15/bin/python"
# or
asv-tachyon sample benchmarks.TimeSuite.time_keys-0 \
  --python /path/to/python3.15
```

## ASV plugin GUI

With `"plugins": ["asv_tachyon.plugin"]` in `asv.conf.json`:

```bash
asv profile --gui=list          # shows tachyon / flamegraph
asv profile --gui=tachyon PATH  # opens HTML flamegraph/heatmap artifacts
```

Note: `asv profile` still *collects* cProfile dumps. For sampling profiles, use `asv-tachyon sample`. The Tachyon GUI opens Tachyon HTML artifacts and points you at `asv-tachyon sample` when handed a cProfile file.

## CLI reference (summary)

| Command | Purpose |
|---------|---------|
| `asv-tachyon sample BENCH` | Run BENCH under Tachyon |
| `asv-tachyon replay BIN` | Convert a binary capture |
| `asv-tachyon open PATH` | Open HTML / heatmap dir |
| `asv-tachyon doctor` | Check 3.15 + imports |
| `asv-tachyon formats` | List output formats |

Useful `sample` flags: `--format`, `--mode`, `-r/--rate`, `--duration`, `--loops`, `-a/--all-threads`, `--native`, `--async-aware`, `--live`, `--browser`, `--baseline` (for diff flame graphs).

## Development

```bash
git clone https://github.com/HaoZeke/asv_tachyon
cd asv_tachyon
uv venv -p 3.12 .venv && source .venv/bin/activate
uv pip install -e '.[test]'
pytest -q
```

Rebuild the README from orgmode:

```bash
./scripts/org_to_md.sh readme_src.org README.md
```

## Name and logo

**Tachyon** is CPython's code name for `profiling.sampling` — a nod to the hypothetical faster-than-light particle, matching the profiler's near-zero-overhead external sampling. The logo is a sampling strobe catching a speed-blurred swallow (ASV's mascot) mid-flight.

## License

MIT. See `LICENSE`.
