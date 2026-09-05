"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupportedLanguage } from "@/lib/problems";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="editor-loading">載入編輯器中…</div>,
});

export type { SupportedLanguage };

export interface CodeEditorProps {
  /** Controlled buffer value. When omitted, the editor manages its own state. */
  value?: string;
  /** Active language (Monaco syntax + intellisense). Defaults to typescript. */
  language?: SupportedLanguage;
  /**
   * Languages offered in the toolbar dropdown. When omitted, the picker is
   * hidden and `language` is fixed.
   */
  allowedLanguages?: SupportedLanguage[];
  /** Called whenever the buffer changes. */
  onChange?: (next: string) => void;
  /** Called whenever the user switches language. */
  onLanguageChange?: (next: SupportedLanguage) => void;
  /** Theme override; defaults to auto light/dark. */
  theme?: "vs" | "vs-dark" | "hc-black";
  /** Per-language starter code. Required if `allowedLanguages` is set. */
  starters?: Partial<Record<SupportedLanguage, string>>;
  /**
   * Key that, when changed, resets the internal buffer to the starter code
   * for the active language. Useful when navigating between problems.
   */
  resetKey?: string;
}

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  cpp: "C++",
  go: "Go",
  rust: "Rust",
  java: "Java",
};

const FALLBACK_STARTER = `// 開始撰寫你的解題程式碼
function solution(input) {
  return input;
}
`;

function starterFor(
  lang: SupportedLanguage,
  starters?: Partial<Record<SupportedLanguage, string>>
): string {
  return starters?.[lang] ?? FALLBACK_STARTER;
}


export function CodeEditor({
  value,
  language = "typescript",
  onChange,
  onLanguageChange,
  theme,
  allowedLanguages,
  starters,
  resetKey,
}: CodeEditorProps) {
  const isControlled = value !== undefined;
  const languages = useMemo<SupportedLanguage[]>(
    () => (allowedLanguages && allowedLanguages.length > 0 ? allowedLanguages : [language]),
    [allowedLanguages, language]
  );
  const showPicker = languages.length > 1;

  const [internalLang, setInternalLang] = useState<SupportedLanguage>(language);
  const activeLang = showPicker ? internalLang : language;

  const [internal, setInternal] = useState<string>(
    () => (starters?.[language] ?? value ?? FALLBACK_STARTER)
  );

  // When the parent swaps problems (or sends a new language prop), reset the
  // internal buffer to the new starter. Controlled consumers get the value
  // from above; we just sync the language. We reset internalLang to the NEW
  // problem's default `language` prop (not `activeLang`, which would read
  // internalLang) so navigating between problems whose `allowedLanguages`
  // differ does not leave the select pointing at a value not in its options.
  const lastResetKey = useRef<string | undefined>(resetKey);
  useEffect(() => {
    if (resetKey !== lastResetKey.current) {
      lastResetKey.current = resetKey;
      setInternalLang(language);
      if (!isControlled) {
        setInternal(starterFor(language, starters));
      }
    }
  }, [resetKey, language, starters, isControlled]);

  const display = isControlled ? value : internal;

  // Theme auto-detects the system palette; the SSR placeholder uses "vs" so the
  // loading text stays legible in either mode.
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;
    const update = () => setSystemDark(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  const resolvedTheme = theme ?? (systemDark ? "vs-dark" : "vs");

  const handleLangChange = (next: SupportedLanguage) => {
    setInternalLang(next);
    onLanguageChange?.(next);
    if (!isControlled) {
      // Switching language resets the buffer to that language's starter so the
      // learner isn't left editing Python with Java boilerplate.
      setInternal(starterFor(next, starters));
    }
  };

  return (
    <div className="editor-shell" data-language={activeLang}>
      <div className="editor-toolbar">
        {showPicker ? (
          <label className="editor-toolbar__picker">
            <span className="editor-toolbar__picker-label">語言</span>
            <select
              className="editor-toolbar__select"
              value={activeLang}
              onChange={(e) => handleLangChange(e.target.value as SupportedLanguage)}
              aria-label="選擇程式語言"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABEL[lang]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="editor-toolbar__lang">{LANGUAGE_LABEL[activeLang]}</span>
        )}
        <span className="editor-toolbar__count">{(display ?? "").length} chars</span>
      </div>
      <div className="editor-body">
        <Editor
          height="100%"
          language={activeLang}
          theme={resolvedTheme}
          value={display}
          onChange={(next) => {
            const v = next ?? "";
            if (!isControlled) setInternal(v);
            onChange?.(v);
          }}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "gutter",
            fontLigatures: true,
          }}
        />
      </div>
    </div>
  );
}
