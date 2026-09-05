import type { Problem } from "@/lib/problems";

export function ProblemView({ problem, showHints = false }: { problem: Problem; showHints?: boolean }) {
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
      {showHints && (
        <>
          <h2>提示（給 Tutor 參考，不顯示給學員）</h2>
          <ol>{problem.hints.map((h, i) => <li key={i}>{h}</li>)}</ol>
        </>
      )}
    </article>
  );
}

// Tiny markdown renderer: paragraphs and inline `code` only.
// Walks character-by-character tracking backtick parity.
// Outside backticks: escapes <>& then converts \n to <br/>.
// Inside backticks: content is treated as literal (no escaping, no <br/> substitution).
function renderMarkdown(md: string): string {
  const paragraphs = md.split(/\n\n+/);
  return paragraphs
    .map((para) => {
      let result = "";
      let i = 0;
      while (i < para.length) {
        if (para[i] === "`") {
          // Count backticks in this span
          let j = i + 1;
          while (j < para.length && para[j] === "`") j++;
          const backtickCount = j - i;
          const codeContent = para.slice(j, para.indexOf("`".repeat(backtickCount), j) === -1 ? para.length : para.indexOf("`".repeat(backtickCount), j));
          result += `<code>${codeContent}</code>`;
          i = j + codeContent.length + backtickCount;
        } else {
          // Outside backticks: accumulate chars until end or a backtick
          let chunkEnd = i;
          while (chunkEnd < para.length && para[chunkEnd] !== "`") {
            chunkEnd++;
          }
          const chunk = para.slice(i, chunkEnd);
          // Escape <, >, & first, then convert \n to <br/>
          const escaped = chunk
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>");
          result += escaped;
          i = chunkEnd;
        }
      }
      return `<p>${result}</p>`;
    })
    .join("");
}
