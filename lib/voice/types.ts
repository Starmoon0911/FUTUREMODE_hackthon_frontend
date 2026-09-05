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
