"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div style={{ padding: 16, color: "var(--color-text-muted)" }}>載入編輯器中…</div>,
});

export type CodeEditorLanguage = "typescript" | "javascript" | "python" | "cpp" | "go" | "rust" | "java";

export interface CodeEditorProps {
  /** Initial code shown in the editor. */
  value?: string;
  /** Language for Monaco's syntax highlighting + intellisense. Defaults to typescript. */
  language?: CodeEditorLanguage;
  /** Called whenever the user edits the buffer. */
  onChange?: (next: string) => void;
  /** Theme override; defaults to auto light/dark. */
  theme?: "vs" | "vs-dark" | "hc-black";
  /** Optional starter code shown in the header. */
  starter?: string;
}

const LANGUAGE_LABEL: Record<CodeEditorLanguage, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  cpp: "C++",
  go: "Go",
  rust: "Rust",
  java: "Java",
};

const DEFAULT_STARTER = `// 開始撰寫你的解題程式碼
function solution(input) {
  return input;
}
`;

export function CodeEditor({
  value,
  language = "typescript",
  onChange,
  theme,
  starter,
}: CodeEditorProps) {
  const [internal, setInternal] = useState<string>(value ?? starter ?? DEFAULT_STARTER);
  const isControlled = value !== undefined;
  const display = isControlled ? value : internal;

  // Auto theme based on prefers-color-scheme if not explicitly set.
  const resolvedTheme =
    theme ??
    (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "vs-dark"
      : "vs");

  return (
    <div className="editor-shell" data-language={language}>
      <div className="editor-toolbar">
        <span className="editor-toolbar__lang">{LANGUAGE_LABEL[language]}</span>
        <span>{display.length} chars</span>
      </div>
      <div className="editor-body">
        <Editor
          height="100%"
          language={language}
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
