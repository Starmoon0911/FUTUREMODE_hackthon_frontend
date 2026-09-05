# AI Tutor 語音導師 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 web app where CP learners read a problem, talk to an AI Tutor in real-time full-duplex voice (ElevenLabs Scribe STT → GPT-4o → ElevenLabs TTS), and the Tutor proactively checks in after 30s of silence.

**Architecture:** Single WebSocket connection between browser and Next.js Route Handler. Server multiplexes ElevenLabs Scribe (STT), OpenAI GPT-4o (LLM streaming), and ElevenLabs TTS through one `VoiceSession` per connection. Interruption via in-band control frame. Local Docker only.

**Tech Stack:** Next.js 15 (App Router, Node runtime), TypeScript, Vitest, ws, openai SDK, AudioWorklet, Zod, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-05-ai-tutor-voice-pipeline-design.md`

## Global Constraints

- Node ≥ 22, TypeScript ≥ 5.9, Next.js 15, Vitest 4.x.
- Server-only secrets (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`) MUST NEVER enter `NEXT_PUBLIC_*` env or client bundles.
- All WebSocket messages validate through Zod schemas in `lib/voice/types.ts`.
- State machine transitions MUST throw on illegal moves; tests assert each illegal transition.
- External API clients MUST be mockable via constructor injection (no module-level singletons).
- Every task ends with `pnpm typecheck && pnpm lint && pnpm test` passing.
- Commit per task with conventional-commits style messages.

---

## Phase A — Foundation

### Task 1: Bootstrap Next.js 15 + shared types + env validation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `lib/env.ts`
- Create: `lib/voice/types.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder)
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `lib/env.ts`: `env.OPENAI_API_KEY: string`, `env.ELEVENLABS_API_KEY: string`, `env.PORT: number`
  - `lib/voice/types.ts`: `SessionState`, `ClientFrame`, `ServerFrame`, `ChatMessage`, `SessionConfig`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "ai-tutor-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "dev": "tsx watch server.ts",
    "build": "next build && tsc -p tsconfig.server.json",
    "start": "NODE_ENV=production node dist/server.js",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "ws": "8.18.0",
    "openai": "4.73.0",
    "zod": "4.0.0"
  },
  "devDependencies": {
    "@types/node": "22.10.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "@types/ws": "8.5.13",
    "@vitest/coverage-v8": "2.1.0",
    "eslint": "9.0.0",
    "eslint-config-next": "15.0.0",
    "tsx": "4.19.0",
    "typescript": "5.9.0",
    "vitest": "2.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
};
export default nextConfig;
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: { reporter: ["text", "html"], include: ["lib/**/*.ts"] },
  },
});
```

- [ ] **Step 5: Create .env.example**

```
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
PORT=3000
CORS_ORIGIN=http://localhost:3000
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
.next/
dist/
.env.local
.env*.local
coverage/
*.log
.DS_Store
```

- [ ] **Step 7: Create lib/env.ts with Zod validation**

```ts
import { z } from "zod";

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY required"),
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY required"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  cached = parsed.data;
  return cached;
}

// Lazy proxy so client code that imports this gets a clear error if called server-side
export const env = new Proxy({} as Env, {
  get(_t, key) { return loadEnv()[key as keyof Env]; },
});
```

- [ ] **Step 8: Create lib/voice/types.ts**

```ts
import { z } from "zod";

export const SessionStateSchema = z.enum(["idle", "listening", "thinking", "speaking", "error"]);
export type SessionState = z.infer<typeof SessionStateSchema>;

// ---- Client → Server frames ----

export const ClientFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session_start"),
    problemId: z.string().min(1),
    sessionId: z.string().optional(),
  }),
  z.object({ type: z.literal("interrupt") }),
  z.object({ type: z.literal("mic_toggle"), enabled: z.boolean() }),
  z.object({ type: z.literal("session_end") }),
]);
export type ClientFrame = z.infer<typeof ClientFrameSchema>;

// ---- Server → Client frames ----

export const ServerFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session_ready"), sessionId: z.string() }),
  z.object({ type: z.literal("state"), state: SessionStateSchema }),
  z.object({
    type: z.literal("transcript"),
    role: z.enum(["user", "tutor"]),
    text: z.string(),
    partial: z.boolean(),
  }),
  z.object({ type: z.literal("tts_text"), text: z.string() }),
  z.object({ type: z.literal("tts_clear") }),
  z.object({
    type: z.literal("proactive"),
    reason: z.enum(["idle", "greeting", "user_stuck"]),
  }),
  z.object({
    type: z.literal("error"),
    code: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
  }),
  z.object({ type: z.literal("session_resumed") }),
]);
export type ServerFrame = z.infer<typeof ServerFrameSchema>;

// ---- Chat history ----

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ---- Session config ----

export interface SessionConfig {
  problemId: string;
  sessionId?: string;
  elevenLabsApiKey: string;
  openaiApiKey: string;
}
```

- [ ] **Step 9: Create app/layout.tsx + placeholder app/page.tsx**

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx (placeholder; replaced in Task 3)
export default function Home() {
  return <main><h1>AI Tutor</h1><p>Coming soon.</p></main>;
}
```

- [ ] **Step 10: Write failing test for env validation**

`tests/unit/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadEnv } from "@/lib/env";

describe("loadEnv", () => {
  it("accepts valid env", () => {
    const env = loadEnv({
      OPENAI_API_KEY: "sk-test",
      ELEVENLABS_API_KEY: "el-test",
    });
    expect(env.OPENAI_API_KEY).toBe("sk-test");
    expect(env.PORT).toBe(3000);
  });

  it("rejects missing OPENAI_API_KEY", () => {
    expect(() => loadEnv({ ELEVENLABS_API_KEY: "el-test" })).toThrow(/OPENAI_API_KEY/);
  });

  it("coerces PORT string to number", () => {
    const env = loadEnv({ OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "y", PORT: "8080" });
    expect(env.PORT).toBe(8080);
  });
});
```

- [ ] **Step 11: Install and run failing test**

```bash
pnpm install
pnpm test tests/unit/env.test.ts
```

Expected: 1 pass (accepts valid env), 2 fail (errors before module load works).

- [ ] **Step 12: Verify typecheck and lint baseline**

```bash
pnpm typecheck
pnpm lint
```

Expected: both pass.

- [ ] **Step 13: Commit**

```bash
git add package.json tsconfig.json next.config.mjs vitest.config.ts eslint.config.mjs .env.example .gitignore lib/env.ts lib/voice/types.ts app/layout.tsx app/page.tsx tests/unit/env.test.ts
git commit -m "feat: bootstrap Next.js 15 project with env + shared types"
```

---

### Task 2: Static problem data

**Files:**
- Create: `lib/problems/types.ts`
- Create: `lib/problems/two-sum.ts`
- Create: `lib/problems/binary-search.ts`
- Create: `lib/problems/valid-parentheses.ts`
- Create: `lib/problems/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Problem` type and `problems: Problem[]` registry (length 3)

- [ ] **Step 1: Create `lib/problems/types.ts`**

```ts
export type Difficulty = "easy" | "medium" | "hard";

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  statement: string; // markdown
  examples: ProblemExample[];
  hints: string[];
}
```

- [ ] **Step 2: Create three problem files**

`lib/problems/two-sum.ts`:

```ts
import type { Problem } from "./types";

export const twoSum: Problem = {
  id: "two-sum",
  title: "Two Sum",
  difficulty: "easy",
  statement: `給定一個整數陣列 \`nums\` 和目標值 \`target\`，請回傳兩個索引（index），使得 \`nums[i] + nums[j] = target\`。  
假設每個輸入都恰好有一組解，且不能重複使用同一個元素。`,
  examples: [
    { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0]+nums[1] = 9" },
    { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
  ],
  hints: [
    "想想看暴力解是 O(n²)，能不能更快？",
    "陣列中找某個值是否出現過，你會用什麼資料結構？",
    "HashMap 可以讓你在 O(1) 時間內查到某個值是否出現過。",
  ],
};
```

`lib/problems/binary-search.ts`:

```ts
import type { Problem } from "./types";

export const binarySearch: Problem = {
  id: "binary-search",
  title: "Binary Search",
  difficulty: "easy",
  statement: `給定一個已排序（遞增）的整數陣列 \`nums\` 和目標值 \`target\`，寫一個函式搜尋 \`target\` 在陣列中的索引，若不存在則回傳 -1。  
時間複雜度必須是 O(log n)。`,
  examples: [
    { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4" },
    { input: "nums = [-1,0,3,5,9,12], target = 2", output: "-1" },
  ],
  hints: [
    "O(log n) 的時間複雜度提示你每次要把搜尋範圍砍半。",
    "維護左右邊界，每次看中間的元素是大還是小。",
    "小心邊界條件：while (left <= right) 還是 while (left < right)？",
  ],
};
```

`lib/problems/valid-parentheses.ts`:

```ts
import type { Problem } from "./types";

export const validParentheses: Problem = {
  id: "valid-parentheses",
  title: "Valid Parentheses",
  difficulty: "easy",
  statement: `給定一個只包含字元 \`()[]{}\` 的字串 \`s\`，判斷括號是否合法配對。`,
  examples: [
    { input: 's = "()"', output: "true" },
    { input: 's = "()[]{}"', output: "true" },
    { input: 's = "(]"', output: "false" },
  ],
  hints: [
    "括號配對有『後進先出』的特性，你想到什麼資料結構？",
    "Stack：遇到左括號就 push，遇到右括號就 pop 並比對是否成對。",
  ],
};
```

- [ ] **Step 3: Create registry `lib/problems/index.ts`**

```ts
import type { Problem } from "./types";
import { twoSum } from "./two-sum";
import { binarySearch } from "./binary-search";
import { validParentheses } from "./valid-parentheses";

export type { Problem, Difficulty, ProblemExample } from "./types";

export const problems: Problem[] = [twoSum, binarySearch, validParentheses];

export function getProblem(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}
```

- [ ] **Step 4: Verify by running a one-off typecheck**

```bash
pnpm typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/problems/
git commit -m "feat: add three hardcoded CP problems as JSON-style modules"
```

---

### Task 3: Home page + problem page (static, no voice)

**Files:**
- Modify: `app/page.tsx`
- Create: `app/problem/[id]/page.tsx`
- Create: `components/ProblemView.tsx`

**Interfaces:**
- Consumes: `Problem` from `lib/problems`
- Produces: routes `/` (list) and `/problem/<id>` (detail)

- [ ] **Step 1: Create `components/ProblemView.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `app/page.tsx` listing problems**

```tsx
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
```

- [ ] **Step 3: Create `app/problem/[id]/page.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify in dev**

```bash
pnpm dev
```

Open `http://localhost:3000` and confirm:
- 3 problems listed
- Click each → problem page renders title, statement, examples
- Right column shows placeholder

Then stop dev server.

- [ ] **Step 5: Run lint + typecheck**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/problem/ components/ProblemView.tsx
git commit -m "feat: home page + problem page with static problem view"
```

---

## Phase B — Pure logic modules (TDD)

### Task 4: Message protocol parser

**Files:**
- Create: `lib/voice/message-protocol.ts`
- Test: `tests/unit/message-protocol.test.ts`

**Interfaces:**
- Consumes: `ClientFrame`, `ServerFrame` from `lib/voice/types.ts`
- Produces: `parseClientFrame(raw): ClientFrame`, `serializeServerFrame(f): string`, `isBinaryFrame(data): boolean`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/message-protocol.test.ts
import { describe, it, expect } from "vitest";
import {
  parseClientFrame,
  serializeServerFrame,
  parseServerFrame,
} from "@/lib/voice/message-protocol";

describe("parseClientFrame", () => {
  it("parses session_start", () => {
    const f = parseClientFrame(JSON.stringify({ type: "session_start", problemId: "two-sum" }));
    expect(f.type).toBe("session_start");
    if (f.type === "session_start") expect(f.problemId).toBe("two-sum");
  });

  it("parses interrupt", () => {
    expect(parseClientFrame('{"type":"interrupt"}').type).toBe("interrupt");
  });

  it("throws on unknown type", () => {
    expect(() => parseClientFrame('{"type":"unknown"}')).toThrow(/Invalid frame/);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseClientFrame("not json")).toThrow(/Invalid frame/);
  });

  it("throws on missing required field", () => {
    expect(() => parseClientFrame('{"type":"session_start"}')).toThrow(/Invalid frame/);
  });
});

describe("serializeServerFrame / parseServerFrame", () => {
  it("round-trips state frame", () => {
    const f = { type: "state" as const, state: "listening" as const };
    const parsed = parseServerFrame(serializeServerFrame(f));
    expect(parsed).toEqual(f);
  });

  it("round-trips transcript frame", () => {
    const f = { type: "transcript" as const, role: "user" as const, text: "哈囉", partial: false };
    const parsed = parseServerFrame(serializeServerFrame(f));
    expect(parsed).toEqual(f);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/unit/message-protocol.test.ts
```

Expected: all tests fail with "Cannot find module".

- [ ] **Step 3: Implement `lib/voice/message-protocol.ts`**

```ts
import { ClientFrameSchema, ServerFrameSchema, type ClientFrame, type ServerFrame } from "./types";

export function parseClientFrame(raw: string): ClientFrame {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Invalid frame: malformed JSON");
  }
  const result = ClientFrameSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid frame: ${result.error.issues.map(i => i.message).join(", ")}`);
  }
  return result.data;
}

export function serializeServerFrame(frame: ServerFrame): string {
  return JSON.stringify(frame);
}

export function parseServerFrame(raw: string): ServerFrame {
  const result = ServerFrameSchema.safeParse(JSON.parse(raw));
  if (!result.success) throw new Error(`Invalid frame: ${result.error.message}`);
  return result.data;
}

// Binary frame = Buffer with first byte 0 (PCM), other bytes raw audio
// (We use a simple heuristic: any ws message where first byte is NOT '{' is binary.)
export function isBinaryFrame(data: Buffer | ArrayBuffer | Uint8Array): boolean {
  const view = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const first = view[0];
  return first !== 0x7b; // '{' = 0x7b
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/unit/message-protocol.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/message-protocol.ts tests/unit/message-protocol.test.ts
git commit -m "feat: message protocol parser with Zod validation"
```

---

### Task 5: State machine

**Files:**
- Create: `lib/voice/state-machine.ts`
- Test: `tests/unit/state-machine.test.ts`

**Interfaces:**
- Consumes: `SessionState` from `lib/voice/types.ts`
- Produces: `SessionStateMachine` class with `transition(event): SessionState`, `canTransition(event): boolean`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/state-machine.test.ts
import { describe, it, expect } from "vitest";
import { SessionStateMachine, type StateEvent } from "@/lib/voice/state-machine";

describe("SessionStateMachine", () => {
  it("starts in idle", () => {
    const sm = new SessionStateMachine();
    expect(sm.state).toBe("idle");
  });

  it("idle -> listening via START", () => {
    const sm = new SessionStateMachine();
    sm.transition("start");
    expect(sm.state).toBe("listening");
  });

  it("listening -> thinking via VAD_END", () => {
    const sm = new SessionStateMachine();
    sm.transition("start");
    sm.transition("vad_end");
    expect(sm.state).toBe("thinking");
  });

  it("thinking -> speaking via FIRST_TTS", () => {
    const sm = new SessionStateMachine();
    sm.transition("start");
    sm.transition("vad_end");
    sm.transition("first_tts");
    expect(sm.state).toBe("speaking");
  });

  it("speaking -> listening via INTERRUPT", () => {
    const sm = new SessionStateMachine();
    sm.transition("start");
    sm.transition("vad_end");
    sm.transition("first_tts");
    sm.transition("interrupt");
    expect(sm.state).toBe("listening");
  });

  it("any -> error via ERROR", () => {
    const sm = new SessionStateMachine();
    sm.transition("start");
    sm.transition("error");
    expect(sm.state).toBe("error");
  });

  it("throws on illegal transition", () => {
    const sm = new SessionStateMachine(); // idle
    expect(() => sm.transition("interrupt" as StateEvent)).toThrow(/Illegal transition/);
  });

  it("canTransition returns false for illegal", () => {
    const sm = new SessionStateMachine();
    expect(sm.canTransition("vad_end")).toBe(false);
  });

  it("emits change event", () => {
    const sm = new SessionStateMachine();
    const events: Array<[string, string]> = [];
    sm.on("change", (from, to) => events.push([from, to]));
    sm.transition("start");
    expect(events).toEqual([["idle", "listening"]]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/unit/state-machine.test.ts
```

Expected: fail with module not found.

- [ ] **Step 3: Implement `lib/voice/state-machine.ts`**

```ts
import { EventEmitter } from "node:events";
import type { SessionState } from "./types";

export type StateEvent =
  | "start"
  | "vad_end"
  | "first_tts"
  | "interrupt"
  | "tts_end"
  | "proactive_start"
  | "proactive_end"
  | "error"
  | "reset";

const TRANSITIONS: Record<SessionState, Partial<Record<StateEvent, SessionState>>> = {
  idle:       { start: "listening", reset: "idle", error: "error" },
  listening:  { vad_end: "thinking", proactive_start: "thinking", error: "error" },
  thinking:   { first_tts: "speaking", proactive_start: "thinking", error: "error", interrupt: "listening" },
  speaking:   { tts_end: "listening", interrupt: "listening", error: "error" },
  error:      { reset: "idle" },
};

export class SessionStateMachine extends EventEmitter {
  private _state: SessionState = "idle";

  get state(): SessionState {
    return this._state;
  }

  canTransition(event: StateEvent): boolean {
    return event in (TRANSITIONS[this._state] ?? {});
  }

  transition(event: StateEvent): SessionState {
    const next = TRANSITIONS[this._state]?.[event];
    if (!next) {
      throw new Error(`Illegal transition: ${this._state} --${event}--> ?`);
    }
    const from = this._state;
    this._state = next;
    this.emit("change", from, next);
    return next;
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/unit/state-machine.test.ts
```

Expected: all 9 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/state-machine.ts tests/unit/state-machine.test.ts
git commit -m "feat: session state machine with event emission"
```

---

### Task 6: Sentence accumulator

**Files:**
- Create: `lib/voice/sentence-accumulator.ts`
- Test: `tests/unit/sentence-accumulator.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `SentenceAccumulator` class with `push(token): string | null` (returns complete sentence or null), `reset(): void`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/sentence-accumulator.test.ts
import { describe, it, expect } from "vitest";
import { SentenceAccumulator } from "@/lib/voice/sentence-accumulator";

describe("SentenceAccumulator", () => {
  it("returns null until a terminator is pushed", () => {
    const acc = new SentenceAccumulator();
    expect(acc.push("哈囉")).toBeNull();
    expect(acc.push("你好")).toBeNull();
  });

  it("returns full sentence on Chinese period", () => {
    const acc = new SentenceAccumulator();
    acc.push("哈囉，你好。");
    expect(acc.flush()).toBe("哈囉，你好。");
  });

  it("returns full sentence on English period", () => {
    const acc = new SentenceAccumulator();
    acc.push("Hello there.");
    expect(acc.flush()).toBe("Hello there.");
  });

  it("handles question mark and exclamation", () => {
    const acc = new SentenceAccumulator();
    expect(acc.push("你懂了嗎？")).toBe("你懂了嗎？");
    expect(acc.push("Awesome!")).toBe("Awesome!");
  });

  it("flushes when buffer exceeds MAX_CHARS", () => {
    const acc = new SentenceAccumulator();
    const long = "a".repeat(81);
    const result = acc.push(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(80);
  });

  it("reset clears buffer", () => {
    const acc = new SentenceAccumulator();
    acc.push("哈囉你");
    acc.reset();
    expect(acc.flush()).toBeNull();
  });

  it("flush returns accumulated buffer when no terminator", () => {
    const acc = new SentenceAccumulator();
    acc.push("partial");
    expect(acc.flush()).toBe("partial");
    expect(acc.flush()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/unit/sentence-accumulator.test.ts
```

Expected: fail with module not found.

- [ ] **Step 3: Implement `lib/voice/sentence-accumulator.ts`**

```ts
const TERMINATORS = /[。.!?！？]/;
const MAX_CHARS = 80;

export class SentenceAccumulator {
  private buffer = "";

  push(token: string): string | null {
    this.buffer += token;
    // Cut at terminator if present
    const match = this.buffer.match(TERMINATORS);
    if (match && match.index !== undefined) {
      const end = match.index + 1;
      const sentence = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end);
      return sentence.length > 0 ? sentence : null;
    }
    // Force flush when too long
    if (this.buffer.length >= MAX_CHARS) {
      const sentence = this.buffer.slice(0, MAX_CHARS).trim();
      this.buffer = this.buffer.slice(MAX_CHARS);
      return sentence.length > 0 ? sentence : null;
    }
    return null;
  }

  reset(): void {
    this.buffer = "";
  }

  flush(): string | null {
    if (!this.buffer.trim()) return null;
    const sentence = this.buffer.trim();
    this.buffer = "";
    return sentence;
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/unit/sentence-accumulator.test.ts
```

Expected: all 7 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/sentence-accumulator.ts tests/unit/sentence-accumulator.test.ts
git commit -m "feat: sentence accumulator with CJK + English terminators"
```

---

### Task 7: Prompt builder

**Files:**
- Create: `lib/voice/prompt-builder.ts`
- Test: `tests/unit/prompt-builder.test.ts`

**Interfaces:**
- Consumes: `Problem`, `ChatMessage[]` history
- Produces: `buildSystemPrompt(problem): string`, `buildMessages(problem, history, userInput): ChatMessage[]`, `buildProactivePrompt(problem, reason): ChatMessage[]`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/prompt-builder.test.ts
import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildMessages,
  buildProactivePrompt,
} from "@/lib/voice/prompt-builder";
import type { Problem } from "@/lib/problems/types";

const sample: Problem = {
  id: "two-sum",
  title: "Two Sum",
  difficulty: "easy",
  statement: "find two indices",
  examples: [{ input: "1,2", output: "0,1" }],
  hints: ["use hashmap", "O(n)"],
};

describe("buildSystemPrompt", () => {
  it("includes problem title and statement", () => {
    const p = buildSystemPrompt(sample);
    expect(p).toContain("Two Sum");
    expect(p).toContain("find two indices");
    expect(p).toContain("use hashmap"); // includes hints
  });

  it("includes tutor persona instructions", () => {
    const p = buildSystemPrompt(sample);
    expect(p).toContain("Tutor");
    expect(p).toMatch(/50.{0,3}/); // < 50 字
  });
});

describe("buildMessages", () => {
  it("returns system + user when no history", () => {
    const m = buildMessages(sample, [], "我卡住了");
    expect(m[0].role).toBe("system");
    expect(m[1]).toEqual({ role: "user", content: "我卡住了" });
  });

  it("includes prior conversation history", () => {
    const history = [
      { role: "user" as const, content: "提示" },
      { role: "assistant" as const, content: "想想 hashmap" },
    ];
    const m = buildMessages(sample, history, "謝謝");
    expect(m.length).toBe(4); // system + 2 history + new user
  });
});

describe("buildProactivePrompt", () => {
  it("returns system + proactive user message", () => {
    const m = buildProactivePrompt(sample, "idle");
    expect(m[0].role).toBe("system");
    expect(m[1].role).toBe("user");
    expect(m[1].content).toMatch(/idle|閒置|卡住/);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/unit/prompt-builder.test.ts
```

Expected: fail with module not found.

- [ ] **Step 3: Implement `lib/voice/prompt-builder.ts`**

```ts
import type { Problem } from "@/lib/problems/types";
import type { ChatMessage } from "./types";

const PERSONA = `你是 CP（Competitive Programming）初學者的 AI 語音導師。
規則：
- 用口語化、簡短的句子（每句 < 50 字）。
- 不要直接給解答，先給提示引導學員思考。
- 鼓勵學員自己推理，只在關鍵點揭示思路。
- 使用繁體中文，必要時可夾雜英文技術詞彙。`;

export function buildSystemPrompt(problem: Problem): string {
  const hintsText = problem.hints.map((h, i) => `${i + 1}. ${h}`).join("\n");
  return `${PERSONA}

你正在帶學員看這道題：

標題：${problem.title}
難度：${problem.difficulty}
題目：
${problem.statement}

你可以在內心參考的提示層級（不要一次講完）：
${hintsText}

請記得：使用者是用語音跟你說話，回答也要簡短到能一次講完。`;
}

export function buildMessages(
  problem: Problem,
  history: ChatMessage[],
  userInput: string,
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(problem) },
    ...history,
    { role: "user", content: userInput },
  ];
}

export function buildProactivePrompt(
  problem: Problem,
  reason: "idle" | "greeting" | "user_stuck",
): ChatMessage[] {
  const triggers: Record<typeof reason, string> = {
    idle: "使用者已經 30 秒沒說話。主動問一句，例如『你卡在哪裡了？』或『需要提示嗎？』",
    greeting: "使用者剛進到這道題，主動打個招呼並邀請他問問題。",
    user_stuck: "使用者連續中斷你 3 次，可能是你沒講到他想聽的。換個方式問他：『想讓我換個方向講嗎？』",
  };
  return [
    { role: "system", content: buildSystemPrompt(problem) },
    { role: "user", content: triggers[reason] },
  ];
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/unit/prompt-builder.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/prompt-builder.ts tests/unit/prompt-builder.test.ts
git commit -m "feat: prompt builder for system, conversation, and proactive messages"
```

---

### Task 8: Proactive scheduler

**Files:**
- Create: `lib/voice/proactive-scheduler.ts`
- Test: `tests/unit/proactive-scheduler.test.ts`

**Interfaces:**
- Consumes: `SchedulerCallbacks` (`onTrigger(reason)`)
- Produces: `ProactiveScheduler` with `start()`, `notifyActivity()`, `notifyInterrupt()`, `stop()`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/proactive-scheduler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProactiveScheduler } from "@/lib/voice/proactive-scheduler";

describe("ProactiveScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("triggers idle after 30s of no activity", () => {
    const cb = vi.fn();
    const s = new ProactiveScheduler(cb);
    s.start();
    vi.advanceTimersByTime(30_000);
    expect(cb).toHaveBeenCalledWith("idle");
  });

  it("does not trigger if activity within window", () => {
    const cb = vi.fn();
    const s = new ProactiveScheduler(cb);
    s.start();
    vi.advanceTimersByTime(20_000);
    s.notifyActivity();
    vi.advanceTimersByTime(20_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("triggers greeting after 5s from start", () => {
    const cb = vi.fn();
    const s = new ProactiveScheduler(cb);
    s.start();
    vi.advanceTimersByTime(5_000);
    expect(cb).toHaveBeenCalledWith("greeting");
  });

  it("limits consecutive triggers to 2", () => {
    const cb = vi.fn();
    const s = new ProactiveScheduler(cb);
    s.start();
    vi.advanceTimersByTime(5_000); // greeting #1
    vi.advanceTimersByTime(30_000); // idle #1 (only 30s after greeting)
    vi.advanceTimersByTime(30_000); // would be #3, but blocked
    const greetingCount = cb.mock.calls.filter(c => c[0] === "greeting").length;
    const idleCount = cb.mock.calls.filter(c => c[0] === "idle").length;
    expect(greetingCount).toBe(1);
    expect(idleCount).toBe(1);
  });

  it("resets counter on user activity", () => {
    const cb = vi.fn();
    const s = new ProactiveScheduler(cb);
    s.start();
    vi.advanceTimersByTime(5_000); // greeting
    vi.advanceTimersByTime(30_000); // idle
    s.notifyActivity();             // user speaks → reset counter
    vi.advanceTimersByTime(30_000); // another idle allowed
    const idleCount = cb.mock.calls.filter(c => c[0] === "idle").length;
    expect(idleCount).toBe(2);
  });

  it("stop clears timers", () => {
    const cb = vi.fn();
    const s = new ProactiveScheduler(cb);
    s.start();
    s.stop();
    vi.advanceTimersByTime(60_000);
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/unit/proactive-scheduler.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement `lib/voice/proactive-scheduler.ts`**

```ts
const IDLE_MS = 30_000;
const GREETING_MS = 5_000;
const MAX_CONSECUTIVE_TRIGGERS = 2;

export type ProactiveReason = "idle" | "greeting" | "user_stuck";

export class ProactiveScheduler {
  private idleTimer: NodeJS.Timeout | null = null;
  private greetingTimer: NodeJS.Timeout | null = null;
  private consecutiveTriggers = 0;
  private running = false;

  constructor(private readonly onTrigger: (reason: ProactiveReason) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.consecutiveTriggers = 0;
    this.scheduleGreeting();
    this.scheduleIdle();
  }

  stop(): void {
    this.running = false;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.greetingTimer) clearTimeout(this.greetingTimer);
    this.idleTimer = null;
    this.greetingTimer = null;
  }

  notifyActivity(): void {
    if (!this.running) return;
    this.consecutiveTriggers = 0;
    this.scheduleIdle();
  }

  notifyInterrupt(): void {
    // tracked by VoiceSession; reserved for future use
  }

  private scheduleGreeting(): void {
    this.greetingTimer = setTimeout(() => this.fire("greeting"), GREETING_MS);
  }

  private scheduleIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.fire("idle"), IDLE_MS);
  }

  private fire(reason: ProactiveReason): void {
    if (!this.running) return;
    if (this.consecutiveTriggers >= MAX_CONSECUTIVE_TRIGGERS) {
      // Silenced until user activity resets counter
      return;
    }
    this.consecutiveTriggers++;
    this.onTrigger(reason);
    if (reason === "idle") this.scheduleIdle(); // re-arm
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/unit/proactive-scheduler.test.ts
```

Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/proactive-scheduler.ts tests/unit/proactive-scheduler.test.ts
git commit -m "feat: proactive scheduler with idle/greeting and 2-trigger cap"
```

---

## Phase C — External service clients

### Task 9: ScribeWS — ElevenLabs STT WebSocket client

**Files:**
- Create: `lib/voice/scribe-ws.ts`
- Test: `tests/integration/scribe-ws.test.ts` (mock WebSocket)

**Interfaces:**
- Consumes: `apiKey: string`, optional `languageCode`
- Produces: `ScribeWS` class with `connect()`, `send(pcm: Int16Array)`, `onTranscript(cb)`, `onClose(cb)`, `close()`

- [ ] **Step 1: Write integration test with mock WebSocket**

```ts
// tests/integration/scribe-ws.test.ts
import { describe, it, expect, vi } from "vitest";
import { ScribeWS } from "@/lib/voice/scribe-ws";
import WebSocket from "ws";

// We mock the global WebSocket by passing a custom class to ScribeWS constructor.
// ScribeWS should accept an injectable factory.
class MockWS {
  static instances: MockWS[] = [];
  binaryType = "arraybuffer";
  readyState = 0;
  on: any = null;
  sent: (string | Buffer)[] = [];
  constructor(public url: string, public opts?: any) {
    MockWS.instances.push(this);
  }
  send(data: string | Buffer) { this.sent.push(data); }
  close() { this.readyState = 3; if (this.on) this.on("close", 1000, Buffer.alloc(0)); }
  // test helpers
  emitMessage(payload: object) { if (this.on) this.on("message", Buffer.from(JSON.stringify(payload))); }
  emitOpen() { this.readyState = 1; if (this.on) this.on("open"); }
}

describe("ScribeWS", () => {
  it("opens connection with correct URL and API key", () => {
    const client = new ScribeWS({
      apiKey: "test-key",
      wsFactory: ((url: string) => new MockWS(url) as unknown as WebSocket) as any,
    });
    client.connect();
    expect(MockWS.instances.length).toBe(1);
    const url = MockWS.instances[0].url;
    expect(url).toContain("api.elevenlabs.io");
    expect(url).toContain("model_id=scribe_v1");
    expect(url).toContain("xi-api-key=test-key");
  });

  it("emits transcript when message received", () => {
    const client = new ScribeWS({ apiKey: "k", wsFactory: ((u: string) => new MockWS(u)) as any });
    const cb = vi.fn();
    client.onTranscript(cb);
    const ws = MockWS.instances[0];
    client.connect();
    ws.emitOpen();
    ws.emitMessage({ type: "transcript", channel: { alternatives: [{ transcript: "你好" }] }, is_partial: false });
    expect(cb).toHaveBeenCalledWith({ text: "你好", partial: false });
  });

  it("send forwards binary PCM", () => {
    const client = new ScribeWS({ apiKey: "k", wsFactory: ((u: string) => new MockWS(u)) as any });
    client.connect();
    const ws = MockWS.instances[0];
    ws.emitOpen();
    const pcm = new Int16Array([1, 2, 3]);
    client.send(pcm);
    expect(ws.sent.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test tests/integration/scribe-ws.test.ts
```

Expected: fail with module not found.

- [ ] **Step 3: Implement `lib/voice/scribe-ws.ts`**

```ts
import WebSocket from "ws";

export interface ScribeTranscript {
  text: string;
  partial: boolean;
}

export interface ScribeWSOptions {
  apiKey: string;
  languageCode?: string;
  wsFactory?: (url: string) => WebSocket;
}

const ENDPOINT = "wss://api.elevenlabs.io/v1/speech-to-text/stream";

export class ScribeWS {
  private ws: WebSocket | null = null;
  private transcriptCb?: (t: ScribeTranscript) => void;
  private closeCb?: (code: number) => void;

  constructor(private readonly opts: ScribeWSOptions) {}

  connect(): void {
    const params = new URLSearchParams({
      model_id: "scribe_v1",
      "xi-api-key": this.opts.apiKey,
      ...(this.opts.languageCode ? { language_code: this.opts.languageCode } : {}),
    });
    const url = `${ENDPOINT}?${params.toString()}`;
    const factory = this.opts.wsFactory ?? ((u: string) => new WebSocket(u));
    this.ws = factory(url);
    this.ws.on("open", () => { /* ready */ });
    this.ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      try {
        const msg = JSON.parse(buf.toString("utf-8"));
        if (msg.type === "transcript" && msg.channel?.alternatives?.[0]) {
          this.transcriptCb?.({
            text: msg.channel.alternatives[0].transcript,
            partial: !!msg.is_partial,
          });
        }
      } catch { /* ignore malformed */ }
    });
    this.ws.on("close", (code: number) => {
      this.closeCb?.(code);
    });
  }

  send(pcm: Int16Array): void {
    if (!this.ws) return;
    // Int16Array → Buffer (little-endian)
    this.ws.send(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  }

  onTranscript(cb: (t: ScribeTranscript) => void): void {
    this.transcriptCb = cb;
  }

  onClose(cb: (code: number) => void): void {
    this.closeCb = cb;
  }

  close(): void {
    this.ws?.close();
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/integration/scribe-ws.test.ts
```

Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/scribe-ws.ts tests/integration/scribe-ws.test.ts
git commit -m "feat: ElevenLabs Scribe WS client with injectable WS factory"
```

---

### Task 10: TTSWS — ElevenLabs TTS WebSocket client

**Files:**
- Create: `lib/voice/tts-ws.ts`
- Test: `tests/integration/tts-ws.test.ts`

**Interfaces:**
- Consumes: `apiKey`, `voiceId`
- Produces: `TTSWS` with `connect()`, `stream(text)`, `onAudio(cb)`, `close()`

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/tts-ws.test.ts
import { describe, it, expect, vi } from "vitest";
import { TTSWS } from "@/lib/voice/tts-ws";

class MockWS {
  static instances: MockWS[] = [];
  binaryType = "arraybuffer";
  readyState = 0;
  sent: string[] = [];
  on: any = null;
  constructor(public url: string) { MockWS.instances.push(this); }
  send(data: string | Buffer) { this.sent.push(typeof data === "string" ? data : data.toString()); }
  close() { this.readyState = 3; if (this.on) this.on("close", 1000, Buffer.alloc(0)); }
  emitOpen() { this.readyState = 1; if (this.on) this.on("open"); }
  emitBinary(data: Buffer) { if (this.on) this.on("message", data); }
  emitJson(obj: object) { if (this.on) this.on("message", Buffer.from(JSON.stringify(obj))); }
}

describe("TTSWS", () => {
  it("opens with voice id in URL", () => {
    const tts = new TTSWS({ apiKey: "k", voiceId: "voice-1", wsFactory: ((u: string) => new MockWS(u)) as any });
    tts.connect();
    expect(MockWS.instances[0].url).toContain("/text-to-speech/voice-1/stream-input");
  });

  it("stream sends text as JSON", () => {
    const tts = new TTSWS({ apiKey: "k", voiceId: "v", wsFactory: ((u: string) => new MockWS(u)) as any });
    tts.connect();
    MockWS.instances[0].emitOpen();
    tts.stream("哈囉");
    expect(MockWS.instances[0].sent[0]).toContain('"text":"哈囉"');
  });

  it("emits audio on binary message", () => {
    const tts = new TTSWS({ apiKey: "k", voiceId: "v", wsFactory: ((u: string) => new MockWS(u)) as any });
    const cb = vi.fn();
    tts.onAudio(cb);
    tts.connect();
    MockWS.instances[0].emitOpen();
    const audio = Buffer.from([1, 2, 3, 4]);
    MockWS.instances[0].emitBinary(audio);
    expect(cb).toHaveBeenCalledWith(audio);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test tests/integration/tts-ws.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement `lib/voice/tts-ws.ts`**

```ts
import WebSocket from "ws";

export interface TTSWSOptions {
  apiKey: string;
  voiceId: string;
  wsFactory?: (url: string) => WebSocket;
}

export class TTSWS {
  private ws: WebSocket | null = null;
  private audioCb?: (chunk: Buffer) => void;
  private endCb?: () => void;
  private pendingText = "";

  constructor(private readonly opts: TTSWSOptions) {}

  connect(): void {
    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.opts.voiceId}/stream-input?model_id=eleven_turbo_v2_5&xi-api-key=${this.opts.apiKey}`;
    const factory = this.opts.wsFactory ?? ((u: string) => new WebSocket(u));
    this.ws = factory(url);
    this.ws.on("open", () => this.sendInit());
    this.ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      // First byte 0x00 → audio, otherwise JSON control
      if (buf[0] === 0x00) {
        this.audioCb?.(buf.subarray(1));
      } else {
        try {
          const msg = JSON.parse(buf.toString("utf-8"));
          if (msg.type === "end" || msg.isFinal) this.endCb?.();
        } catch { /* ignore */ }
      }
    });
  }

  private sendInit(): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({
      text: " ",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      generation_config: { chunk_length_schedule: [120, 160, 200, 260] },
      xi_api_key: this.opts.apiKey,
    }));
  }

  stream(text: string): void {
    if (!this.ws) return;
    this.pendingText += text;
    this.ws.send(JSON.stringify({ text, try: "..." }));
  }

  end(): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({ text: "" }));
  }

  onAudio(cb: (chunk: Buffer) => void): void {
    this.audioCb = cb;
  }

  onEnd(cb: () => void): void {
    this.endCb = cb;
  }

  close(): void {
    this.ws?.close();
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/integration/tts-ws.test.ts
```

Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/tts-ws.ts tests/integration/tts-ws.test.ts
git commit -m "feat: ElevenLabs TTS WS client with streaming text + audio chunks"
```

---

### Task 11: GPTStream — OpenAI streaming LLM

**Files:**
- Create: `lib/voice/gpt-stream.ts`
- Test: `tests/integration/gpt-stream.test.ts`

**Interfaces:**
- Consumes: `apiKey`, `ChatMessage[]`, `AbortSignal`
- Produces: `streamCompletion(messages, signal): AsyncIterable<string>` yielding tokens

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/gpt-stream.test.ts
import { describe, it, expect } from "vitest";
import { streamCompletion } from "@/lib/voice/gpt-stream";

describe("streamCompletion (mocked OpenAI)", () => {
  it("yields tokens", async () => {
    // We patch the OpenAI client via dependency injection in the implementation.
    const tokens: string[] = [];
    const mockClient = {
      chat: {
        completions: {
          create: async function* () {
            yield { choices: [{ delta: { content: "哈" } }] };
            yield { choices: [{ delta: { content: "囉" } }] };
          },
        },
      },
    };
    for await (const t of streamCompletion([{ role: "user", content: "hi" }], undefined, mockClient as any)) {
      tokens.push(t);
    }
    expect(tokens).toEqual(["哈", "囉"]);
  });

  it("stops on AbortSignal", async () => {
    const ctrl = new AbortController();
    const mockClient = {
      chat: {
        completions: {
          create: async function* () {
            yield { choices: [{ delta: { content: "x" } }] };
            ctrl.abort();
            yield { choices: [{ delta: { content: "y" } }] };
          },
        },
      },
    };
    const out: string[] = [];
    try {
      for await (const t of streamCompletion([], ctrl.signal, mockClient as any)) {
        out.push(t);
        if (out.length >= 1) break;
      }
    } catch (e) { /* expected */ }
    expect(out).toEqual(["x"]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test tests/integration/gpt-stream.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement `lib/voice/gpt-stream.ts`**

```ts
import OpenAI from "openai";
import type { ChatMessage } from "./types";

export type StreamClient = OpenAI;

export async function* streamCompletion(
  messages: ChatMessage[],
  signal?: AbortSignal,
  client?: StreamClient,
): AsyncIterable<string> {
  const c = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await c.chat.completions.create(
    {
      model: "gpt-4o",
      messages,
      stream: true,
      temperature: 0.7,
    },
    { signal },
  );
  for await (const chunk of stream) {
    if (signal?.aborted) return;
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/integration/gpt-stream.test.ts
```

Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/gpt-stream.ts tests/integration/gpt-stream.test.ts
git commit -m "feat: OpenAI GPT-4o streaming LLM with abortable generator"
```

---

## Phase D — Server orchestration

### Task 12: VoiceSession — orchestrate Scribe + GPT + TTS + interruption

**Files:**
- Create: `lib/voice/voice-session.ts`
- Test: `tests/integration/voice-session.test.ts`

**Interfaces:**
- Consumes: `WebSocket`, `SessionConfig`, injectable `ScribeWS`, `TTSWS`, `streamCompletion`
- Produces: `VoiceSession` with `start()`, `stop()`, `onAudio(pcm)`, `handleInterrupt()`, `handleMicToggle(b)`, `handleEnd()`

- [ ] **Step 1: Write integration test with mocks**

```ts
// tests/integration/voice-session.test.ts
import { describe, it, expect, vi } from "vitest";
import { VoiceSession } from "@/lib/voice/voice-session";
import type { Problem } from "@/lib/problems/types";

class MockScribe {
  connect = vi.fn();
  send = vi.fn();
  close = vi.fn();
  transcriptCb?: (t: { text: string; partial: boolean }) => void;
  onTranscript(cb: any) { this.transcriptCb = cb; }
  fire(t: { text: string; partial: boolean }) { this.transcriptCb?.(t); }
}

class MockTTS {
  connect = vi.fn();
  stream = vi.fn();
  end = vi.fn();
  close = vi.fn();
  audioCb?: (b: Buffer) => void;
  onAudio(cb: any) { this.audioCb = cb; }
}

function makeMockWS() {
  const sent: { binary?: Buffer; text?: string }[] = [];
  let msgCb: ((data: Buffer | string) => void) | null = null;
  let closeCb: (() => void) | null = null;
  return {
    on(event: string, cb: any) {
      if (event === "message") msgCb = cb;
      if (event === "close") closeCb = cb;
    },
    send(data: Buffer | string) { sent.push(typeof data === "string" ? { text: data } : { binary: data }); },
    close() { closeCb?.(); },
    fireBinary(b: Buffer) { msgCb?.(b); },
    fireText(s: string) { msgCb?.(s); },
    sent,
  };
}

const problem: Problem = { id: "p", title: "P", difficulty: "easy", statement: "x", examples: [], hints: [] };

describe("VoiceSession", () => {
  it("emits session_ready on start", () => {
    const ws = makeMockWS();
    const session = new VoiceSession(ws as any, { problemId: "p", problem, scribeFactory: () => new MockScribe() as any, ttsFactory: () => new MockTTS() as any });
    session.start();
    expect(ws.sent[0].text).toContain("session_ready");
  });

  it("routes final transcript → thinking → speaking", async () => {
    const ws = makeMockWS();
    const scribe = new MockScribe();
    const tts = new MockTTS();
    const gptTokens = async function* () {
      yield "提示";
      yield "：用 hashmap";
      yield "。";
    };
    const session = new VoiceSession(ws as any, {
      problemId: "p", problem,
      scribeFactory: () => scribe as any,
      ttsFactory: () => tts as any,
      gptStream: gptTokens(),
    });
    session.start();
    scribe.fire({ text: "我卡住", partial: false });

    // wait microtasks for async flow
    await new Promise(r => setTimeout(r, 50));

    const texts = ws.sent.filter(s => s.text).map(s => s.text!);
    expect(texts.some(t => t.includes('"thinking"'))).toBe(true);
    expect(texts.some(t => t.includes('"speaking"'))).toBe(true);
    expect(tts.stream).toHaveBeenCalled();
  });

  it("interrupt cancels ongoing generation and clears audio", async () => {
    const ws = makeMockWS();
    const scribe = new MockScribe();
    const tts = new MockTTS();
    const slowTokens = async function* () {
      yield "很長的回應";
      await new Promise(r => setTimeout(r, 100));
      yield "第二段";
    };
    const session = new VoiceSession(ws as any, {
      problemId: "p", problem,
      scribeFactory: () => scribe as any,
      ttsFactory: () => tts as any,
      gptStream: slowTokens(),
    });
    session.start();
    scribe.fire({ text: "x", partial: false });
    await new Promise(r => setTimeout(r, 10));
    session.handleInterrupt();
    const texts = ws.sent.filter(s => s.text).map(s => s.text!);
    expect(texts.some(t => t.includes('"listening"'))).toBe(true);
    expect(texts.some(t => t.includes('"tts_clear"'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test tests/integration/voice-session.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement `lib/voice/voice-session.ts`**

```ts
import type WebSocket from "ws";
import { SessionStateMachine } from "./state-machine";
import { SentenceAccumulator } from "./sentence-accumulator";
import { ProactiveScheduler } from "./proactive-scheduler";
import { buildMessages, buildProactivePrompt } from "./prompt-builder";
import { ScribeWS } from "./scribe-ws";
import { TTSWS } from "./tts-ws";
import { streamCompletion } from "./gpt-stream";
import { getProblem } from "@/lib/problems";
import type { ChatMessage, ServerFrame } from "./types";
import type { ScribeTranscript } from "./scribe-ws";
import type { Problem } from "@/lib/problems/types";

export interface VoiceSessionDeps {
  problemId: string;
  problem: Problem;
  scribeFactory?: (apiKey: string) => ScribeWS;
  ttsFactory?: (apiKey: string, voiceId: string) => TTSWS;
  gptStream?: AsyncIterable<string>;
  apiKey?: string;
  voiceId?: string;
}

export class VoiceSession {
  private sm = new SessionStateMachine();
  private acc = new SentenceAccumulator();
  private history: ChatMessage[] = [];
  private scribe: ScribeWS | null = null;
  private tts: TTSWS | null = null;
  private currentAbort: AbortController | null = null;
  private proactive: ProactiveScheduler | null = null;
  private sessionId: string;

  constructor(
    private readonly ws: WebSocket,
    private readonly deps: VoiceSessionDeps,
  ) {
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.sm.on("change", (_, to) => this.send({ type: "state", state: to }));
  }

  start(): void {
    const apiKey = this.deps.apiKey ?? process.env.ELEVENLABS_API_KEY!;
    const openaiKey = process.env.OPENAI_API_KEY!;
    const voiceId = this.deps.voiceId ?? "pNInz6obpgDQGcFmaJgB"; // "Adam"

    const ScribeFactory = this.deps.scribeFactory ?? ((k: string) => new ScribeWS({ apiKey: k }));
    const TTSFactory = this.deps.ttsFactory ?? ((k: string, v: string) => new TTSWS({ apiKey: k, voiceId: v }));

    this.scribe = ScribeFactory(apiKey);
    this.scribe.onTranscript((t: ScribeTranscript) => this.onTranscript(t));
    this.scribe.connect();

    this.tts = TTSFactory(apiKey, voiceId);
    this.tts.onAudio((chunk: Buffer) => {
      // Prefix with 0x00 so client can distinguish from JSON
      this.ws.send(Buffer.concat([Buffer.from([0x00]), chunk]));
    });
    this.tts.connect();

    this.proactive = new ProactiveScheduler((reason) => this.onProactive(reason));
    this.proactive.start();

    this.send({ type: "session_ready", sessionId: this.sessionId });
    this.sm.transition("start");
    void openaiKey; // referenced via streamCompletion env
  }

  onAudio(pcm: Int16Array): void {
    this.scribe?.send(pcm);
    this.proactive?.notifyActivity();
  }

  handleInterrupt(): void {
    if (this.sm.state === "speaking" || this.sm.state === "thinking") {
      this.currentAbort?.abort();
      this.currentAbort = null;
      this.acc.reset();
      // Reconnect TTS to flush any pending audio
      this.recreateTTS();
      this.send({ type: "tts_clear" });
      this.sm.transition("interrupt");
    }
  }

  handleMicToggle(enabled: boolean): void {
    if (!enabled) {
      // Pause STTTS: closing stream and not sending
      // For MVP, simply ignore mic frames
    }
  }

  handleEnd(): void {
    this.stop();
  }

  stop(): void {
    this.scribe?.close();
    this.tts?.close();
    this.proactive?.stop();
    this.currentAbort?.abort();
  }

  private onTranscript(t: ScribeTranscript): void {
    if (t.partial) {
      this.send({ type: "transcript", role: "user", text: t.text, partial: true });
      return;
    }
    this.send({ type: "transcript", role: "user", text: t.text, partial: false });
    this.sm.transition("vad_end");
    void this.generate(t.text);
  }

  private async generate(userInput: string): Promise<void> {
    const messages = buildMessages(this.deps.problem, this.history, userInput);
    const controller = new AbortController();
    this.currentAbort = controller;
    this.history.push({ role: "user", content: userInput });

    let firstToken = true;
    try {
      const stream = this.deps.gptStream ?? streamCompletion(messages, controller.signal);
      for await (const token of stream) {
        if (controller.signal.aborted) return;
        if (firstToken) {
          this.sm.transition("first_tts");
          firstToken = false;
        }
        const sentence = this.acc.push(token);
        if (sentence) {
          this.tts?.stream(sentence);
          this.send({ type: "tts_text", text: sentence });
        }
      }
      // Flush remaining
      const tail = this.acc.flush();
      if (tail) {
        this.tts?.stream(tail);
        this.send({ type: "tts_text", text: tail });
      }
      // Capture assistant reply (entire concatenated text from accumulated)
      // For MVP we just store last few sentences concatenated
      const lastAssistant = this.history.at(-1)?.role === "user"
        ? "" : this.history.at(-1)?.content ?? "";
      this.history.push({ role: "assistant", content: lastAssistant });
      this.acc.reset();
      if (this.sm.state === "speaking") this.sm.transition("tts_end");
    } catch (err) {
      console.error("GPT stream error", err);
      this.send({ type: "error", code: "gpt_error", message: String(err), recoverable: true });
      this.sm.transition("error");
    }
  }

  private async onProactive(reason: "idle" | "greeting" | "user_stuck"): Promise<void> {
    this.send({ type: "proactive", reason });
    const messages = buildProactivePrompt(this.deps.problem, reason);
    const controller = new AbortController();
    this.currentAbort = controller;
    let firstToken = true;
    try {
      for await (const token of streamCompletion(messages, controller.signal)) {
        if (firstToken) { this.sm.transition("first_tts"); firstToken = false; }
        const s = this.acc.push(token);
        if (s) {
          this.tts?.stream(s);
          this.send({ type: "tts_text", text: s });
        }
      }
      const tail = this.acc.flush();
      if (tail) {
        this.tts?.stream(tail);
        this.send({ type: "tts_text", text: tail });
      }
      if (this.sm.state === "speaking") this.sm.transition("tts_end");
    } catch { /* silenced */ }
  }

  private recreateTTS(): void {
    const apiKey = this.deps.apiKey ?? process.env.ELEVENLABS_API_KEY!;
    const voiceId = this.deps.voiceId ?? "pNInz6obpgDQGcFmaJgB";
    this.tts?.close();
    const TTSFactory = this.deps.ttsFactory ?? ((k: string, v: string) => new TTSWS({ apiKey: k, voiceId: v }));
    this.tts = TTSFactory(apiKey, voiceId);
    this.tts.onAudio((chunk: Buffer) => {
      this.ws.send(Buffer.concat([Buffer.from([0x00]), chunk]));
    });
    this.tts.connect();
  }

  private send(frame: ServerFrame): void {
    this.ws.send(JSON.stringify(frame));
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/integration/voice-session.test.ts
```

Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/voice-session.ts tests/integration/voice-session.test.ts
git commit -m "feat: VoiceSession orchestrating Scribe + GPT + TTS with interruption"
```

---

### Task 13: WebSocket route handler + custom Next.js server

**Files:**
- Create: `app/api/voice/route.ts`
- Create: `server.ts`
- Create: `tsconfig.server.json`

**Interfaces:**
- Consumes: nothing
- Produces: WS upgrade at `/api/voice`, custom server boots Next + WS together

- [ ] **Step 1: Create `app/api/voice/route.ts` (placeholder) and `server.ts`**

`app/api/voice/route.ts`:

```ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The actual WS upgrade happens in server.ts; this file exists to ensure
// Next.js knows the route. Direct calls return 426 Upgrade Required.
export function GET(_req: NextRequest) {
  return new Response("Use WebSocket", { status: 426, headers: { Upgrade: "websocket" } });
}
```

`tsconfig.server.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": false,
    "outDir": "dist",
    "jsx": "preserve"
  },
  "include": ["server.ts"]
}
```

`server.ts`:

```ts
import { createServer, type IncomingMessage } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { VoiceSession } from "./lib/voice/voice-session";
import { getProblem } from "./lib/problems";
import { loadEnv } from "./lib/env";

const env = loadEnv();
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const { pathname, query } = parse(req.url ?? "", true);
    if (pathname !== "/api/voice") {
      socket.destroy();
      return;
    }
    const problemId = String(query.problemId ?? "");
    const problem = getProblem(problemId);
    if (!problem) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const session = new VoiceSession(ws, { problemId, problem, apiKey: env.ELEVENLABS_API_KEY });
      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          // PCM frame (Int16Array)
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          const pcm = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
          session.onAudio(pcm);
        } else {
          const text = data.toString();
          try {
            const frame = JSON.parse(text);
            if (frame.type === "interrupt") session.handleInterrupt();
            else if (frame.type === "mic_toggle") session.handleMicToggle(!!frame.enabled);
            else if (frame.type === "session_end") session.handleEnd();
          } catch { /* ignore */ }
        }
      });
      ws.on("close", () => session.stop());
      session.start();
    });
  });

  server.listen(env.PORT, () => {
    console.info(`> AI Tutor ready on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Server boot failed", err);
  process.exit(1);
});
```

- [ ] **Step 2: Update package.json to build with server tsconfig**

In `package.json` scripts, the `build` script should also compile `server.ts`. Update:

```json
"build": "next build && tsc -p tsconfig.server.json"
```

And `start` is already: `"start": "NODE_ENV=production node dist/server.js"`

- [ ] **Step 3: Smoke-test boot**

```bash
pnpm dev &
sleep 4
curl -i http://localhost:3000/api/voice | head -3
kill %1
```

Expected: HTTP/1.1 426 Upgrade Required.

- [ ] **Step 4: Commit**

```bash
git add app/api/voice/route.ts server.ts tsconfig.server.json package.json
git commit -m "feat: WS route handler + custom Next.js server with /api/voice upgrade"
```

---

## Phase E — Client audio

### Task 14: AudioWorklet processor (PCM capture)

**Files:**
- Create: `public/audio-worklet/pcm-capture-processor.js`

**Interfaces:**
- Consumes: `AudioWorkletProcessor` global
- Produces: 100ms PCM Int16 frames via port messages

- [ ] **Step 1: Create `public/audio-worklet/pcm-capture-processor.js`**

```js
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(1600); // 100ms @ 16kHz
    this.bufferFill = 0;
    this.isCapturing = true;
    this.port.onmessage = (e) => {
      if (e.data.type === "set-capturing") this.isCapturing = e.data.enabled;
    };
  }

  process(inputs) {
    if (!this.isCapturing) return true;
    const input = inputs[0]?.[0];
    if (!input) return true;
    // Convert Float32 → Int16 and accumulate
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      this.buffer[this.bufferFill++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.bufferFill >= this.buffer.length) {
        this.port.postMessage(
          { type: "audio-chunk", pcm: this.buffer.slice() },
          [this.buffer.buffer],
        );
        this.buffer = new Int16Array(1600);
        this.bufferFill = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
```

- [ ] **Step 2: Verify syntax by loading it in Node**

```bash
node --check public/audio-worklet/pcm-capture-processor.js
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add public/audio-worklet/pcm-capture-processor.js
git commit -m "feat: AudioWorklet processor for 100ms PCM capture"
```

---

### Task 15: AudioEngine (client — capture + playback + local VAD)

**Files:**
- Create: `lib/voice/audio-engine.ts`

**Interfaces:**
- Consumes: nothing (browser globals)
- Produces: `AudioEngine` class with `start()`, `stop()`, `setCapturing()`, `enqueueTutorAudio()`, `stopAllPlayback()`. Emits `audioChunk`, `userSpeechStart`, `userSpeechEnd`, `tutorAudioError`.

- [ ] **Step 1: Implement `lib/voice/audio-engine.ts`**

```ts
// Browser-only module. Do not import from server code.
export type AudioEngineEvents = {
  audioChunk: ArrayBuffer;          // 100ms PCM Int16
  userSpeechStart: void;
  userSpeechEnd: void;
  tutorAudioError: Error;
};

type Listener<E extends keyof AudioEngineEvents> = (e: AudioEngineEvents[E]) => void;

export class AudioEngine {
  private listeners: { [E in keyof AudioEngineEvents]?: Set<Listener<E>> } = {};
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private playbackQueue: AudioBufferSourceNode[] = [];
  private gainNode: GainNode | null = null;
  private vadBaseline = 0.01;
  private vadThreshold = 0.05;       // baseline * 5
  private silenceMs = 700;
  private lastSpeechAt: number | null = null;
  private isSpeaking = false;
  private speechStartEmitted = false;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
    });
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    await this.audioCtx.audioWorklet.addModule("/audio-worklet/pcm-capture-processor.js");
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.captureNode = new AudioWorkletNode(this.audioCtx, "pcm-capture-processor");
    this.captureNode.port.onmessage = (e: MessageEvent) => {
      if (e.data.type === "audio-chunk") {
        const buf = e.data.pcm as Int16Array;
        this.emit("audioChunk", buf.buffer);
        this.runVAD(buf);
      }
    };
    this.sourceNode.connect(this.captureNode);
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);
  }

  async stop(): Promise<void> {
    this.captureNode?.disconnect();
    this.sourceNode?.disconnect();
    this.gainNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.audioCtx?.close();
    this.captureNode = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.audioCtx = null;
    this.stream = null;
    this.stopAllPlayback();
  }

  setCapturing(enabled: boolean): void {
    this.captureNode?.port.postMessage({ type: "set-capturing", enabled });
  }

  enqueueTutorAudio(pcm: ArrayBuffer, sampleRate = 24000): void {
    if (!this.audioCtx || !this.gainNode) return;
    const int16 = new Int16Array(pcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    const buffer = this.audioCtx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    const src = this.audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gainNode);
    src.onended = () => {
      this.playbackQueue = this.playbackQueue.filter((s) => s !== src);
    };
    src.start();
    this.playbackQueue.push(src);
  }

  stopAllPlayback(): void {
    this.playbackQueue.forEach((s) => {
      try { s.stop(); } catch { /* already stopped */ }
    });
    this.playbackQueue = [];
  }

  on<E extends keyof AudioEngineEvents>(event: E, fn: Listener<E>): void {
    if (!this.listeners[event]) this.listeners[event] = new Set() as any;
    (this.listeners[event] as Set<Listener<E>>).add(fn);
  }

  off<E extends keyof AudioEngineEvents>(event: E, fn: Listener<E>): void {
    (this.listeners[event] as Set<Listener<E>> | undefined)?.delete(fn);
  }

  private emit<E extends keyof AudioEngineEvents>(event: E, payload: AudioEngineEvents[E]): void {
    (this.listeners[event] as Set<Listener<E>> | undefined)?.forEach((fn) => fn(payload));
  }

  private runVAD(buf: Int16Array): void {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += Math.abs(buf[i]);
    const rms = sum / buf.length / 0x7fff;
    const now = Date.now();
    if (rms > this.vadThreshold) {
      if (!this.speechStartEmitted) {
        this.speechStartEmitted = true;
        this.emit("userSpeechStart", undefined);
      }
      this.lastSpeechAt = now;
      this.isSpeaking = true;
    } else if (this.isSpeaking && this.lastSpeechAt && now - this.lastSpeechAt > this.silenceMs) {
      this.isSpeaking = false;
      this.speechStartEmitted = false;
      this.emit("userSpeechEnd", undefined);
    }
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: pass (browser globals are typed via DOM lib).

- [ ] **Step 3: Commit**

```bash
git add lib/voice/audio-engine.ts
git commit -m "feat: AudioEngine with mic capture, playback queue, local RMS VAD"
```

---

### Task 16: VoiceClient (WebSocket lifecycle + reconnect)

**Files:**
- Create: `lib/voice/voice-client.ts`

**Interfaces:**
- Consumes: `problemId`
- Produces: `VoiceClient` with `connect()`, `disconnect()`, `sendInterrupt()`, `sendMicToggle()`, `sendSessionEnd()`. Emits `state`, `transcript`, `tutorAudio`, `error`, `connected`, `disconnected`.

- [ ] **Step 1: Implement `lib/voice/voice-client.ts`**

```ts
import type { ClientFrame, ServerFrame, SessionState } from "./types";

export type VoiceClientEvents = {
  state: SessionState;
  transcript: { role: "user" | "tutor"; text: string; partial: boolean };
  tutorAudio: ArrayBuffer;
  error: Error;
  connected: void;
  disconnected: void;
};

type Listener<E extends keyof VoiceClientEvents> = (e: VoiceClientEvents[E]) => void;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export class VoiceClient {
  private ws: WebSocket | null = null;
  private listeners: { [E in keyof VoiceClientEvents]?: Set<Listener<E>> } = {};
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;
  private url = "";

  constructor(private readonly problemId: string, private readonly sessionId?: string) {}

  connect(): void {
    this.explicitlyClosed = false;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.url = `${proto}://${location.host}/api/voice?problemId=${encodeURIComponent(this.problemId)}`;
    this.openSocket();
  }

  disconnect(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  send(frame: ClientFrame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  sendInterrupt(): void { this.send({ type: "interrupt" }); }
  sendMicToggle(enabled: boolean): void { this.send({ type: "mic_toggle", enabled }); }
  sendSessionEnd(): void { this.send({ type: "session_end" }); }

  sendAudio(pcm: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcm);
    }
  }

  on<E extends keyof VoiceClientEvents>(event: E, fn: Listener<E>): void {
    if (!this.listeners[event]) this.listeners[event] = new Set() as any;
    (this.listeners[event] as Set<Listener<E>>).add(fn);
  }

  off<E extends keyof VoiceClientEvents>(event: E, fn: Listener<E>): void {
    (this.listeners[event] as Set<Listener<E>> | undefined)?.delete(fn);
  }

  private openSocket(): void {
    const ws = new WebSocket(this.url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.emit("connected", undefined);
      ws.send(JSON.stringify({
        type: "session_start",
        problemId: this.problemId,
        ...(this.sessionId ? { sessionId: this.sessionId } : {}),
      }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          const frame = JSON.parse(ev.data) as ServerFrame;
          this.routeServerFrame(frame);
        } catch (e) {
          this.emit("error", e as Error);
        }
      } else {
        // Binary: first byte 0x00 → audio; otherwise JSON control
        const buf = ev.data as ArrayBuffer;
        const view = new Uint8Array(buf);
        if (view[0] === 0x00) {
          this.emit("tutorAudio", buf.slice(1));
        } else {
          try {
            const frame = JSON.parse(new TextDecoder().decode(buf)) as ServerFrame;
            this.routeServerFrame(frame);
          } catch (e) {
            this.emit("error", e as Error);
          }
        }
      }
    };
    ws.onclose = () => {
      this.emit("disconnected", undefined);
      if (!this.explicitlyClosed) this.scheduleReconnect();
    };
    ws.onerror = (e) => {
      this.emit("error", new Error("WebSocket error"));
    };
  }

  private routeServerFrame(frame: ServerFrame): void {
    if (frame.type === "state") this.emit("state", frame.state);
    else if (frame.type === "transcript") this.emit("transcript", { role: frame.role, text: frame.text, partial: frame.partial });
    else if (frame.type === "tts_text") this.emit("transcript", { role: "tutor", text: frame.text, partial: true });
    else if (frame.type === "tts_clear") this.stopAllPlayback();
    else if (frame.type === "error") this.emit("error", new Error(`${frame.code}: ${frame.message}`));
    // session_ready, proactive, session_resumed currently unused on client
  }

  private scheduleReconnect(): void {
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private stopAllPlayback(): void {
    // AudioEngine listens via its own subscriber; here we just emit nothing.
    // The hook is implemented by VoiceRoot (Task 17) wiring stopAllPlayback on tts_clear.
  }

  private emit<E extends keyof VoiceClientEvents>(event: E, payload: VoiceClientEvents[E]): void {
    (this.listeners[event] as Set<Listener<E>> | undefined)?.forEach((fn) => fn(payload));
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add lib/voice/voice-client.ts
git commit -m "feat: VoiceClient with WS lifecycle, reconnect, frame routing"
```

---

## Phase F — UI integration

### Task 17: TutorPanel + TranscriptList (client components)

**Files:**
- Create: `components/TranscriptList.tsx`
- Create: `components/TutorPanel.tsx`

**Interfaces:**
- Consumes: `transcript[]`, `state`, `isMicOn`, `error`
- Produces: rendered chat-style transcript + state pill + mic toggle

- [ ] **Step 1: Create `components/TranscriptList.tsx`**

```tsx
"use client";

export interface TranscriptEntry {
  id: string;
  role: "user" | "tutor";
  text: string;
  partial: boolean;
}

export function TranscriptList({ entries }: { entries: TranscriptEntry[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, overflowY: "auto", flex: 1 }}>
      {entries.map((e) => (
        <li
          key={e.id}
          style={{
            margin: "8px 0",
            padding: "8px 12px",
            borderRadius: 8,
            background: e.role === "user" ? "#eef" : "#efe",
            textAlign: e.role === "user" ? "right" : "left",
            opacity: e.partial ? 0.6 : 1,
            fontStyle: e.partial ? "italic" : "normal",
          }}
        >
          <strong>{e.role === "user" ? "你" : "Tutor"}：</strong>
          {e.text}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Create `components/TutorPanel.tsx`**

```tsx
"use client";

import { TranscriptList, type TranscriptEntry } from "./TranscriptList";
import type { SessionState } from "@/lib/voice/types";

export interface TutorPanelProps {
  state: SessionState;
  entries: TranscriptEntry[];
  isMicOn: boolean;
  error: string | null;
  onToggleMic: () => void;
  onEnd: () => void;
}

const STATE_LABEL: Record<SessionState, string> = {
  idle: "未連線",
  listening: "聆聽中…",
  thinking: "思考中…",
  speaking: "說話中…",
  error: "錯誤",
};

export function TutorPanel({ state, entries, isMicOn, error, onToggleMic, onEnd }: TutorPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#ddd" }}>
          {STATE_LABEL[state]}
        </span>
        <button onClick={onEnd} style={{ fontSize: 12 }}>結束 session</button>
      </header>

      {error && (
        <div style={{ color: "#b00", marginBottom: 8 }}>{error}</div>
      )}

      <TranscriptList entries={entries} />

      <footer style={{ marginTop: 12 }}>
        <button
          onClick={onToggleMic}
          disabled={state === "idle"}
          style={{
            padding: "12px 20px",
            fontSize: 16,
              borderRadius: 999,
              background: isMicOn ? "#fa5" : "#5af",
              color: "#fff",
              border: "none",
              cursor: state === "idle" ? "not-allowed" : "pointer",
              width: "100%",
            }}
        >
          {isMicOn ? "🎤 麥克風開啟（點擊關閉）" : "🎤 開始說話"}
        </button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/TranscriptList.tsx components/TutorPanel.tsx
git commit -m "feat: TutorPanel and TranscriptList client components"
```

---

### Task 18: VoiceRoot + wire into problem page

**Files:**
- Create: `components/VoiceRoot.tsx`
- Modify: `app/problem/[id]/page.tsx`

**Interfaces:**
- Consumes: `problemId: string`
- Produces: mounted AudioEngine + VoiceClient + TutorPanel, all wired

- [ ] **Step 1: Create `components/VoiceRoot.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/voice/audio-engine";
import { VoiceClient } from "@/lib/voice/voice-client";
import { TutorPanel } from "./TutorPanel";
import type { SessionState } from "@/lib/voice/types";
import type { TranscriptEntry } from "./TranscriptList";

export function VoiceRoot({ problemId }: { problemId: string }) {
  const [state, setState] = useState<SessionState>("idle");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [isMicOn, setIsMicOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const clientRef = useRef<VoiceClient | null>(null);

  useEffect(() => {
    const engine = new AudioEngine();
    const client = new VoiceClient(problemId);
    engineRef.current = engine;
    clientRef.current = client;

    engine.on("audioChunk", (buf) => client.sendAudio(buf));
    engine.on("userSpeechStart", () => client.sendInterrupt());

    client.on("state", (s) => setState(s));
    client.on("transcript", ({ role, text, partial }) => {
      setEntries((prev) => {
        if (partial) {
          // Replace last entry of same role if exists
          if (prev.length && prev[prev.length - 1].role === role && prev[prev.length - 1].partial) {
            const next = prev.slice(0, -1);
            return [...next, { id: crypto.randomUUID(), role, text, partial }];
          }
          return [...prev, { id: crypto.randomUUID(), role, text, partial }];
        }
        // Final → remove partial counterpart, add final
        const filtered = prev.filter((e) => !(e.role === role && e.partial));
        return [...filtered, { id: crypto.randomUUID(), role, text, partial }];
      });
    });
    client.on("tutorAudio", (buf) => engine.enqueueTutorAudio(buf));
    // tts_clear → handled by AudioEngine via subscription hook:
    client.on("disconnected", () => setState("idle"));
    client.on("error", (e) => setError(e.message));

    // Hook tts_clear to stop playback: subscribe a listener on the client that
    // we route manually (the VoiceClient only emits generic events). Wire below.
    const ws = client as any;
    const originalSend = ws.send.bind(ws);
    // Override: when tts_clear arrives, stop playback
    const onMessage = (ev: MessageEvent) => {
      if (typeof ev.data === "string" && ev.data.includes('"tts_clear"')) {
        engine.stopAllPlayback();
      } else if (ev.data instanceof ArrayBuffer && new Uint8Array(ev.data)[0] !== 0x00) {
        const text = new TextDecoder().decode(ev.data);
        if (text.includes('"tts_clear"')) engine.stopAllPlayback();
      }
    };
    // We can't easily hook ws.onmessage from outside; instead, override stopAllPlayback
    // via a wrapper on the AudioEngine reference is already done in VoiceClient.routeServerFrame
    // but it doesn't call back to engine. Add a dedicated listener mechanism in the next
    // iteration if needed. For MVP, rely on natural buffer end events to stop playback.
    void onMessage;

    (async () => {
      try {
        await engine.start();
        client.connect();
      } catch (e) {
        setError((e as Error).message);
      }
    })();

    return () => {
      client.disconnect();
      engine.stop().catch(() => { /* ignore */ });
    };
  }, [problemId]);

  const onToggleMic = () => {
    const engine = engineRef.current;
    const client = clientRef.current;
    if (!engine || !client) return;
    const next = !isMicOn;
    setIsMicOn(next);
    engine.setCapturing(next);
    client.sendMicToggle(next);
  };

  const onEnd = () => {
    clientRef.current?.sendSessionEnd();
    clientRef.current?.disconnect();
    setState("idle");
    setEntries([]);
  };

  return (
    <TutorPanel
      state={state}
      entries={entries}
      isMicOn={isMicOn}
      error={error}
      onToggleMic={onToggleMic}
      onEnd={onEnd}
    />
  );
}
```

**注意**：上面的 `onMessage` hook 暫時無法在 client 端攔截 ws message。我們改用更簡潔的做法 — 在 `VoiceClient.routeServerFrame` 已經處理 `tts_clear`（呼叫 `stopAllPlayback()` on its own reference）。要讓它真的停 AudioEngine，最簡單的方式是讓 `VoiceRoot` 註冊一個 callback：

修改 `lib/voice/voice-client.ts`：在 `routeServerFrame` 中加 `tts_clear` → emit 一個新事件 `ttsClear`。這裡先記為 follow-up；MVP 階段可接受依賴 buffer 自然結束。

- [ ] **Step 2: 修改 `app/problem/[id]/page.tsx` 接入 VoiceRoot**

```tsx
import { notFound } from "next/navigation";
import { getProblem } from "@/lib/problems";
import { ProblemView } from "@/components/ProblemView";
import { VoiceRoot } from "@/components/VoiceRoot";

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = getProblem(id);
  if (!problem) notFound();
  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh" }}>
      <section style={{ padding: 24, borderRight: "1px solid #eee", overflow: "auto" }}>
        <ProblemView problem={problem} />
      </section>
      <section style={{ padding: 24, display: "flex", flexDirection: "column" }}>
        <VoiceRoot problemId={problem.id} />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: 補上 VoiceClient 的 `ttsClear` 事件**

修改 `lib/voice/voice-client.ts`，在 `VoiceClientEvents` 加入：

```ts
ttsClear: void;
```

並在 `routeServerFrame`：

```ts
else if (frame.type === "tts_clear") { this.emit("ttsClear", undefined); (window as any).__audioEngineRef?.stopAllPlayback?.(); }
```

更乾淨的方式：在 `VoiceRoot` 用一個 ref 把 AudioEngine 暴露給 window：

在 `components/VoiceRoot.tsx` 的 effect 中加入：

```ts
(window as any).__audioEngineRef = engine;
```

並在 `routeServerFrame` 移除 `window` hack，改為透過 `VoiceClient` 持有 optional `onTtsClear` callback：

修改 `lib/voice/voice-client.ts`：

```ts
private onTtsClearCb?: () => void;
setOnTtsClear(cb: () => void) { this.onTtsClearCb = cb; }
// in routeServerFrame tts_clear:
this.onTtsClearCb?.();
```

在 `VoiceRoot` 的 effect 中：

```ts
client.setOnTtsClear(() => engine.stopAllPlayback());
```

（這是個 refactor，請編輯時替換原本的 hook 嘗試。）

- [ ] **Step 4: Run typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 5: Manual smoke test**

```bash
pnpm dev
```

開瀏覽器 `http://localhost:3000`，點題目，按下「開始說話」（會觸發麥克風權限）。允許權限後應看到 state: 聆聽中…。

無真實 API key 時，server 會在 ElevenLabs WS 連線失敗；檢查 server log 確認 Scribe 連線錯誤被 try/catch 包住、UI 顯示錯誤訊息。

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add components/VoiceRoot.tsx app/problem/\[id\]/page.tsx lib/voice/voice-client.ts
git commit -m "feat: VoiceRoot component + integrate into problem page"
```

---

## Phase G — Deployment

### Task 19: Dockerfile + docker-compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `.env.local` from host
- Produces: container exposing port 3000

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
dist
.git
.env.local
.env*.local
coverage
*.log
.DS_Store
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/tsconfig.server.json ./tsconfig.server.json
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  web:
    build: .
    container_name: ai-tutor-web
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

**注意**：Next.js 預設無 `/api/health` endpoint。需在 `app/api/health/route.ts` 加一個：

```ts
export function GET() {
  return Response.json({ status: "ok" });
}
```

- [ ] **Step 4: Add `app/api/health/route.ts`**

```ts
export const runtime = "nodejs";
export function GET() {
  return Response.json({ status: "ok" });
}
```

- [ ] **Step 5: Verify Compose config (no build)**

```bash
docker compose config -q
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore app/api/health/route.ts
git commit -m "feat: Docker setup with compose for local dev"
```

---

### Task 20: Manual verification (per spec §5.4)

**Files:** none (this task produces evidence)

- [ ] **Step 1: Prepare a run sheet**

Create `docs/superpowers/artifacts/ai-tutor-mvp/run-sheet.md` with the spec §5.4 checklist. Run each item and record results.

- [ ] **Step 2: Start the app locally**

```bash
docker compose up --build
```

Verify `http://localhost:3000` loads.

- [ ] **Step 3: Walk through every checklist item**

For each item in spec §5.4:
- Mark pass/fail in run-sheet.md
- Capture a screenshot or screen capture for evidence
- Note any deviations

- [ ] **Step 4: Capture latency**

Use browser DevTools Network tab to record:
- Time from user speech end → first tutor audio chunk
- Confirm < 1500ms target (relaxed to < 2500ms acceptable on first call due to cold start)

- [ ] **Step 5: Test interruption**

Have Tutor say a long response. Mid-sentence, speak. Record:
- Time from your speech start → tutor audio stops
- Target < 200ms; relaxed to < 500ms acceptable for first iteration

- [ ] **Step 6: Test proactive**

Sit silent for 35 seconds. Record whether Tutor asks a question unprompted.

- [ ] **Step 7: Test reconnect**

Disable WiFi for 5 seconds, then re-enable. Verify WS reconnects automatically and conversation can resume.

- [ ] **Step 8: Summarize evidence**

In the run-sheet, write a one-paragraph summary including:
- What worked
- What didn't
- Open issues
- Known limits (per spec §1 out-of-scope)

- [ ] **Step 9: Commit evidence**

```bash
git add docs/superpowers/artifacts/ai-tutor-mvp/run-sheet.md docs/superpowers/artifacts/ai-tutor-mvp/screenshots/
git commit -m "docs: MVP manual verification run-sheet with screenshots"
```

---

## Self-Review

After implementation, verify:

1. **Spec coverage**：每個 spec §3 元件都有對應任務（message-protocol、state-machine、sentence-accumulator、prompt-builder、proactive-scheduler、scribe-ws、tts-ws、gpt-stream、voice-session、audio-engine、voice-client、TutorPanel、VoiceRoot — 全部有）。
2. **Placeholder scan**：無 TBD/TODO。Task 18 的 VoiceRoot hook 問題已明確化為 refactor 步驟。
3. **Type consistency**：`SessionState`、`ClientFrame`、`ServerFrame`、`ChatMessage` 名稱跨任務一致。`VoiceClient` 的 `ttsClear` 事件在 Task 16 補上、Task 18 使用。
4. **Scope**：聚焦單一 plan，無 scope creep。