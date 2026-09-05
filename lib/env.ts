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
  // Ruling 8: brief's spec caches unconditionally which breaks the test that
  // passes a different source on each call. Cache only when called with the
  // default `process.env` (the only case the spec actually needs fast-path).
  if (source === process.env && cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

// Lazy proxy so client code that imports this gets a clear error if called server-side
export const env = new Proxy({} as Env, {
  get(_t, key) { return loadEnv()[key as keyof Env]; },
});
