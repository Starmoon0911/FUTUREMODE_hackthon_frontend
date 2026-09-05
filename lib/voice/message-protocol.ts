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
