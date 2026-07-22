import { useMemo } from "react";
import { detectSourceLang, highlightSource, type SourceLang } from "../lib/detectLang";

type Props = {
  code: string;
  /** Force a language, or "auto" (default) to detect. */
  lang?: SourceLang | "auto" | string;
  className?: string;
  /** Show detected language badge (default true when auto). */
  showLangBadge?: boolean;
};

/**
 * Theme-sensitive code block via highlight.js.
 * Language defaults to autodetection (ASV heuristics + highlightAuto subset).
 * Token colors come from CSS variables (--syn-*) switched by data-theme.
 */
export function CodeBlock({
  code,
  lang = "auto",
  className,
  showLangBadge,
}: Props) {
  const { lang: resolved, html } = useMemo(() => {
    if (!code) return { lang: "text" as const, html: null };
    if (lang && lang !== "auto") return highlightSource(code, lang);
    return highlightSource(code, null);
  }, [code, lang]);

  const badge =
    showLangBadge ?? (lang === "auto" || lang == null || lang === undefined);

  const cls = ["code-block", "hljs", className].filter(Boolean).join(" ");

  return (
    <div className="code-block-wrap">
      {badge && resolved !== "text" && (
        <div className="code-lang-badge" title="Detected source language">
          {resolved}
        </div>
      )}
      {html == null ? (
        <pre className={cls}>
          <code className={`code-block-inner language-${resolved}`}>{code}</code>
        </pre>
      ) : (
        <pre className={cls}>
          <code
            className={`code-block-inner language-${resolved}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      )}
    </div>
  );
}

export { detectSourceLang, highlightSource };
export type { SourceLang };
