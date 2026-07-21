# asv-tachyon (diagnostic CLI only)

> **Wrong shape for an ASV metric plugin.**  
> For `sample_*` benchmarks that **store numbers in ASV results** (like `asv_bench_memray`), use:
>
> **[asv_bench_tachyon](https://pypi.org/project/asv-bench-tachyon/)**  
> https://github.com/HaoZeke/asv_bench_tachyon

## What this package was

A CLI wrapper around Python 3.15 `profiling.sampling` plus an `asv profile --gui=tachyon` hook. That is **profiler diagnostics**, not an `asv_runner` benchmark type. `asv_runner` only auto-loads distributions whose name starts with `asv_bench`.

| Package | Role |
|---------|------|
| **asv_bench_tachyon** | `def sample_*(...):` → metric in `asv run` / graphs / compare |
| **asv-tachyon** (this) | optional CLI / GUI helper; not a memray-style plugin |

```bash
pip install asv_bench_tachyon   # the real plugin
```

```python
def sample_hot():
    ...
# asv run --bench sample_hot
```

## License

MIT.
