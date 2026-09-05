import Link from "next/link";
import { problems } from "@/lib/problems";

export default function Home() {
  return (
    <main className="home">
      <h1 className="home__title">AI Tutor</h1>
      <p className="home__lede">選一個題目開始練習，AI 語音導師會陪你一起解題。</p>
      <ul className="problem-list">
        {problems.map((p) => (
          <li key={p.id}>
            <Link href={`/problem/${p.id}`} className="problem-card">
              <div className="problem-card__title">{p.title}</div>
              <div className="problem-card__meta">
                <span className={`badge badge--${p.difficulty}`}>{p.difficulty}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
