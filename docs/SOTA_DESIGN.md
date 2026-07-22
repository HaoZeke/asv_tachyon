# Design notes: static-first SOTA

## Principles

1. **Static host first** — GH Pages, no API. Sidecars are optional JSON next to `index.json`.
2. **ASV data contract** — do not require core asv changes for basic time series; extend graph *cells* optionally.
3. **Criterion depth without Criterion lock-in** — distribution + report subview when samples exist.
4. **SaaS density, open hosting** — heatmaps, chips, virtualization without cloud accounts.
5. **Sparse motion** — CSS transitions only; no confetti.

## Extended graph cell

```json
[12, { "v": 1.2e-5, "lo": 1.1e-5, "hi": 1.3e-5, "samples": [1.15e-5, 1.2e-5, ...] }]
```

Classic `[12, 1.2e-5]` still works.

## Sidecars

| File | Role |
|------|------|
| `commits.json` | hash/revision -> subject |
| `profiles.json` | bench@rev -> static HTML path |
| `regressions-ignore.json` | team mute list |
| `samples/...` | optional external sample vectors |

## Non-goals

- Cloud runners / isolation (CodSpeed)
- Replacing Criterion local HTML reports for pure Rust crates (use adapter instead)
