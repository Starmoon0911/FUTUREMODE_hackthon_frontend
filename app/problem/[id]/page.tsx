import { notFound } from "next/navigation";
import { getProblem } from "@/lib/problems";
import { ProblemView } from "@/components/ProblemView";

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = getProblem(id);
  if (!problem) notFound();
  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh" }}>
      <section style={{ padding: 24, borderRight: "1px solid #eee", overflow: "auto" }}>
        <ProblemView problem={problem} />
      </section>
      <section style={{ padding: 24 }} id="tutor-slot">
        {/* VoiceRoot will be mounted here in Task 18 */}
        <p>（語音 Tutor 即將上線）</p>
      </section>
    </main>
  );
}
