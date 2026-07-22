import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";

// Core + Python only keeps the static SPA lean (ASV benches are Python).
hljs.registerLanguage("python", python);

type Props = {
  code: string;
  lang?: "python" | "text";
  className?: string;
};

/**
 * Theme-sensitive code block via highlight.js.
 * Token colors come from CSS variables (--syn-*) switched by data-theme.
 */
export function CodeBlock({ code, lang = "python", className }: Props) {
  const html = useMemo(() => {
    if (lang !== "python" || !code) return null;
    return hljs.highlight(code, { language: "python", ignoreIllegals: true }).value;
  }, [code, lang]);

  const cls = ["code-block", "hljs", className].filter(Boolean).join(" ");

  if (html == null) {
    return (
      <pre className={cls}>
        <code className={`code-block-inner language-${lang}`}>{code}</code>
      </pre>
    );
  }

  return (
    <pre className={cls}>
      <code
        className={`code-block-inner language-${lang}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}
