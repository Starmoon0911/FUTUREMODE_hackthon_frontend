import { describe, it, expect } from "vitest";
import { loadEnv } from "@/lib/env";

describe("loadEnv", () => {
  it("accepts valid env", () => {
    const env = loadEnv({
      OPENAI_API_KEY: "sk-test",
      ELEVENLABS_API_KEY: "el-test",
    } as unknown as NodeJS.ProcessEnv);
    expect(env.OPENAI_API_KEY).toBe("sk-test");
    expect(env.PORT).toBe(3000);
  });

  it("rejects missing OPENAI_API_KEY", () => {
    expect(() => loadEnv({ ELEVENLABS_API_KEY: "el-test" } as unknown as NodeJS.ProcessEnv)).toThrow(/OPENAI_API_KEY/);
  });

  it("coerces PORT string to number", () => {
    const env = loadEnv({ OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "y", PORT: "8080" } as unknown as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(8080);
  });
});
