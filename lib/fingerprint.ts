import { createHash } from "node:crypto";

/**
 * Deterministic fingerprint for grouping runtime events into issues.
 * Uses service + category + first stack frame (or message) so the same
 * underlying error groups together even when the message has dynamic bits.
 */
export function computeFingerprint(input: {
  serviceName: string;
  category: string;
  message: string;
  stackTrace?: string | null;
}) {
  const stackKey = input.stackTrace
    ? firstStackFrame(input.stackTrace)
    : normalizeMessage(input.message);

  const raw = `${input.serviceName}::${input.category}::${stackKey}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

function firstStackFrame(stack: string): string {
  for (const line of stack.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("at ")) return trimmed;
  }
  return normalizeMessage(stack);
}

function normalizeMessage(msg: string): string {
  return msg
    .replace(/\b\d+\b/g, "N")
    .replace(/0x[0-9a-fA-F]+/g, "0xN")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function deriveIssueTitle(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
}
