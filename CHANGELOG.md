# Changelog

<!-- towncrier release notes start -->

## [0.1.1](https://github.com/HaoZeke/asv_tachyon/tree/v0.1.1) - 2026-07-21

### Bug Fixes

- Call the raw benchmark function in the sampling driver (same target as
  `asv profile` / `do_profile`), not `do_run()`. For `time_*` benchmarks,
  `do_run()` is the adaptive timeit protocol and inflated sample walls.

## [0.1.0](https://github.com/HaoZeke/asv_tachyon/tree/v0.1.0) - 2026-07-21

### New Features

- Initial release: sample ASV benchmarks with Python 3.15 Tachyon
  (`profiling.sampling`), emit flame graphs / heatmaps / gecko / binary
  captures, and register an `asv profile --gui=tachyon` viewer.
