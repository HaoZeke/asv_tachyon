/** Empty / error recipes for missing publish artifacts. */

export function EmptyState({
  kind,
}: {
  kind: "no-index" | "empty-graphs" | "no-regressions" | "no-benches" | "generic";
  detail?: string;
}) {
  const recipes: Record<string, { title: string; body: string; cmds: string[] }> = {
    "no-index": {
      title: "No index.json",
      body: "This directory is not a published ASV html tree yet.",
      cmds: ["asv run", "asv publish", "asv-tachyon install .asv/html", "asv-tachyon serve .asv/html --open"],
    },
    "empty-graphs": {
      title: "No graph data",
      body: "index.json loaded but graphs are empty or missing for this filter.",
      cmds: ["asv run", "asv publish", "asv-tachyon serve .asv/html"],
    },
    "no-regressions": {
      title: "No regressions feed",
      body: "regressions.json is absent or empty. Publish with the regressions step enabled.",
      cmds: ["asv publish", "asv-tachyon install .asv/html"],
    },
    "no-benches": {
      title: "No matching benchmarks",
      body: "Filters hid every bench. Clear type chips or search.",
      cmds: [],
    },
    generic: {
      title: "Nothing here",
      body: "Try another view or reset filters.",
      cmds: ["asv publish", "asv-tachyon serve fixtures/sample_site --open"],
    },
  };
  const r = recipes[kind] || recipes.generic;
  return (
    <div className="empty empty-recipe">
      <strong>{r.title}</strong>
      <p className="muted">{r.body}</p>
      {r.cmds.length > 0 && (
        <pre className="recipe-cmds">{r.cmds.join("\n")}</pre>
      )}
    </div>
  );
}

export function CopyDeepLinkButton() {
  return (
    <button
      type="button"
      className="btn-ghost"
      title="Copy URL with hash filters"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
        } catch {
          // fallback
          const ta = document.createElement("textarea");
          ta.value = window.location.href;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
      }}
    >
      Copy link
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn-ghost" title="Print / save as PDF" onClick={() => window.print()}>
      Print / PDF
    </button>
  );
}
