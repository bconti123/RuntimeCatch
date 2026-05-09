import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const API_KEY_PREFIX = "rc_live_";

export type GeneratedApiKey = {
  /** Plaintext key — shown to the user exactly once at creation time. */
  plaintext: string;
  /** Stored prefix used for display, e.g. `rc_live_3a9f`. */
  prefix: string;
  /** SHA-256 hex digest stored in the database for lookup. */
  keyHash: string;
};

export function generateApiKey(): GeneratedApiKey {
  const random = randomBytes(24).toString("hex"); // 48 chars
  const plaintext = `${API_KEY_PREFIX}${random}`;
  const prefix = `${API_KEY_PREFIX}${random.slice(0, 4)}`;
  const keyHash = hashApiKey(plaintext);
  return { plaintext, prefix, keyHash };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token.startsWith(API_KEY_PREFIX)) return null;
  return token;
}

export type AuthenticatedKey = {
  apiKeyId: string;
  projectId: string;
};

export async function authenticateApiKey(
  authHeader: string | null
): Promise<AuthenticatedKey | null> {
  const token = parseBearer(authHeader);
  if (!token) return null;

  const keyHash = hashApiKey(token);
  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, projectId: true, revokedAt: true },
  });
  if (!key || key.revokedAt) return null;

  return { apiKeyId: key.id, projectId: key.projectId };
}

export async function touchApiKey(apiKeyId: string): Promise<void> {
  await prisma.apiKey
    .update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});
}
