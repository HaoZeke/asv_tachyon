import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import rust from "highlight.js/lib/languages/rust";
import cmake from "highlight.js/lib/languages/cmake";
import xml from "highlight.js/lib/languages/xml";
import ini from "highlight.js/lib/languages/ini";

/** Languages registered for Source autodetection (keep the subset small). */
export const SOURCE_LANGS = [
  "python",
  "cpp",
  "c",
  "bash",
  "javascript",
  "rust",
  "cmake",
  "xml",
  "ini",
] as const;

export type SourceLang = (typeof SOURCE_LANGS)[number] | "text";

let registered = false;

export function ensureHljsLangs(): void {
  if (registered) return;
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("cpp", cpp);
  hljs.registerLanguage("c", c);
  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("rust", rust);
  hljs.registerLanguage("cmake", cmake);
  hljs.registerLanguage("xml", xml);
  hljs.registerLanguage("ini", ini);
  registered = true;
}

/**
 * Detect source language for ASV bench.code (and similar).
 * Prefers ASV Python signals, then #include → C/C++, then hljs highlightAuto
 * restricted to SOURCE_LANGS.
 */
export function detectSourceLang(code: string): SourceLang {
  if (!code || !code.trim()) return "text";
  ensureHljsLangs();

  // ASV benchmark classes almost always look like this (Python).
  if (
    /^\s*class\s+[A-Za-z_]\w*/m.test(code) &&
    /\bdef\s+(time_|peakmem_|mem_|track_)/m.test(code)
  ) {
    return "python";
  }
  if (/^\s*(def|async\s+def|import |from \w+ import)\b/m.test(code) && !/#include/.test(code)) {
    // Strong Python without ASV method names
    if (/\bself\b/.test(code) || /:\s*$/m.test(code)) return "python";
  }
  if (/^\s*#include\s*[<"]/m.test(code) || /^\s*template\s*</m.test(code)) {
    return "cpp";
  }
  if (/^\s*fn\s+\w+/m.test(code) && /\b(pub|impl|struct|use)\b/.test(code)) {
    return "rust";
  }
  if (/^\s*(function |const |export |=>)/m.test(code) && /[{};]/.test(code)) {
    return "javascript";
  }
  if (/^\s*cmake_minimum_required\b/m.test(code) || /^\s*project\s*\(/m.test(code)) {
    return "cmake";
  }
  if (/^\s*#!\/.+\b(bash|sh)\b/m.test(code) || /^\s*set -euo?\s+pipefail/m.test(code)) {
    return "bash";
  }

  const r = hljs.highlightAuto(code, [...SOURCE_LANGS]);
  const lang = r.language as SourceLang | undefined;
  // Ignore low-confidence guesses
  if (lang && (r.relevance ?? 0) >= 5) return lang;
  // ASV default: Python source for tracked benches
  return "python";
}

/** Highlight code; returns { lang, html } or null html for plain. */
export function highlightSource(
  code: string,
  lang?: string | null,
): { lang: SourceLang; html: string | null } {
  ensureHljsLangs();
  const detected: SourceLang =
    lang && lang !== "auto" && lang !== "text"
      ? (SOURCE_LANGS as readonly string[]).includes(lang)
        ? (lang as SourceLang)
        : detectSourceLang(code)
      : detectSourceLang(code);
  if (detected === "text" || !code) return { lang: "text", html: null };
  try {
    const html = hljs.highlight(code, {
      language: detected,
      ignoreIllegals: true,
    }).value;
    return { lang: detected, html };
  } catch {
    return { lang: "text", html: null };
  }
}
