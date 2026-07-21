# Changelog

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
