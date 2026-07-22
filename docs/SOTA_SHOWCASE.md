# SOTA visuals showcase checklist (asv-numpy)

Use after landing visual features. Target: https://haozeke.github.io/asv-numpy/

## Static contract

- [ ] `asv-tachyon install` over publish tree; `.nojekyll` present
- [ ] No CDN fonts (view-source / network tab offline)
- [ ] Relative assets under `/asv-numpy/` project Pages path

## Explore

- [ ] CI band visible when graph cells have `lo`/`hi` (or skip if absent)
- [ ] Distribution panel when samples present
- [ ] Brush zoom + dual-cursor delta
- [ ] Commit tooltip (with `commits.json`) or hash-only fallback
- [ ] Tag markers when `index.tags` non-empty
- [ ] Report subview: vs previous rev/tag language
- [x] Profile link when `profiles.json` matches
- [ ] Copy deep link restores view + bench + filters

## Overview / Heatmap / Grid / Multiples

- [ ] Filter chips (type, only-regressed) update counts
- [ ] Progressive load does not freeze on 300+ benches
- [ ] Heatmap opens Explore on cell/row click
- [ ] Summary grid for multi-param benches
- [ ] Multiples wall selects N benches

## Regressions / Inventory / Compare

- [ ] Mute list persists (localStorage); published `regressions-ignore.json` merges
- [ ] Inventory env-diff still works
- [ ] Multi-env compare columns still work
- [ ] Print stylesheet usable for Compare + Inventory

## Empty / error

- [ ] Missing `index.json` shows publish/install recipe
