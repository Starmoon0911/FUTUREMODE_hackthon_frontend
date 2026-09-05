import Link from "next/link";
import { notFound } from "next/navigation";
import { getProblem } from "@/lib/problems";
import { ProblemView } from "@/components/ProblemView";
import { CodeEditor } from "@/components/CodeEditor";

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = getProblem(id);
  if (!problem) notFound();
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/" className="app-header__back">← 回首頁</Link>
        <span className="app-header__title">{problem.title}</span>
      </header>
      <div className="problem-grid">
        <section className="problem-grid__panel" aria-label="題目說明">
          <div className="problem-grid__panel-header">題目</div>
          <div className="problem-grid__panel-body">
            <ProblemView problem={problem} />
          </div>
        </section>
        <section className="problem-grid__panel" aria-label="程式碼編輯器">
          <div className="problem-grid__panel-header">編輯器</div>
          <div className="problem-grid__panel-body" style={{ padding: 0 }}>
            <CodeEditor language="typescript" />
          </div>
        </section>
        <section className="problem-grid__panel" aria-label="AI 語音導師" id="tutor-slot">
          <div className="problem-grid__panel-header">AI 導師</div>
          <div className="problem-grid__panel-body">
            {/* VoiceRoot will be mounted here in Task 18 */}
            <div className="tutor-placeholder">
              <div className="tutor-placeholder__icon">🎙️</div>
              <p>（語音 Tutor 即將上線）</p>
              <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-3)" }}>
                點擊上方「AI 導師」分頁啟動語音對話
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
