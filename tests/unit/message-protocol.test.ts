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
