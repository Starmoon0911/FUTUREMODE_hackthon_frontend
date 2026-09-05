import type { Problem } from "@/lib/problems";

export function ProblemView({ problem }: { problem: Problem }) {
  return (
    <article className="prose">
      <h1>{problem.title}</h1>
      <p><span className="badge">{problem.difficulty}</span></p>
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.statement) }} />
      <h2>範例</h2>
      {problem.examples.map((ex, i) => (
        <div key={i}>
          <p><strong>輸入：</strong><code>{ex.input}</code></p>
          <p><strong>輸出：</strong><code>{ex.output}</code></p>
          {ex.explanation && <p><em>{ex.explanation}</em></p>}
        </div>
      ))}
      <h2>提示（給 Tutor 參考，不顯示給學員）</h2>
      <ol>{problem.hints.map((h, i) => <li key={i}>{h}</li>)}</ol>
    </article>
  );
}

// Tiny markdown renderer: paragraphs and inline `code` only.
function renderMarkdown(md: string): string {
  const paragraphs = md.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const withCode = p.replace(/`([^`]+)`/g, '<code>$1</code>');
      return `<p>${withCode.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}
