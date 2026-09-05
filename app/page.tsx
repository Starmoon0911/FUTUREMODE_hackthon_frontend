import Link from "next/link";
import { problems } from "@/lib/problems";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>AI Tutor</h1>
      <p>選一個題目開始練習：</p>
      <ul>
        {problems.map((p) => (
          <li key={p.id}>
            <Link href={`/problem/${p.id}`}>{p.title}</Link>
            {" "}<small>({p.difficulty})</small>
          </li>
        ))}
      </ul>
    </main>
  );
}
