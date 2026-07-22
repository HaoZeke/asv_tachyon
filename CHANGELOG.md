## 0.5.0

- Statistical depth: violin/strip/KDE distribution panel, mean/median/MAD, sample CI bands
- Explore: brush zoom, dual-cursor delta, commit tooltips, tag markers, report subview
- Heatmap, summary grid, multiples wall; filter chips with counts
- Progressive overview tiles; higher-is-better / throughput-aware ratios
- Mute list (localStorage + regressions-ignore.json); profile links
- Adapters for Criterion and pytest-benchmark; asv-studio workflow template
- Print stylesheet; empty/error recipes; SOTA design + showcase docs

## 0.4.0

- Regressions view with interactive factor threshold.
- Multi-env Compare columns (compare-many style).
- Param multi-series overlays with stable colors.
- Preserve filters when switching benchmarks; URL hash state.
- Self-hosted DM Sans / JetBrains Mono (no Google Fonts CDN).
- Publish data-contract docs for adapters.

# Changelog

## 0.3.1

- Docs site and README gallery with live asv-tachyon screenshots (Overview,
  Compare, Inventory). Sphinx + Shibuya landing under ``docs/source/``.

## 0.3.0

- **Inventory** view: SBOM-style environment lock diffs (added / removed /
  version-bumped / unchanged), matching `asv-spyglass env-diff` / eb-stack
  `stack_diff`.
- Published-env mode diffs the selected `params` + machine facts from
  `index.json`.
- Result-file mode: drag-drop two ASV result JSON files for full requirements
  matrix classify.

## 0.2.0

- Reposition as a **modern ASV results UI** (not a sampling CLI / metric plugin).
- `asv-tachyon serve` and `asv-tachyon install` over `asv publish` output.
- React + uPlot frontend reading stock `index.json` + `graphs/`.

## 0.1.x

- Earlier mistaken CLI packaging; superseded.
