"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";

const CreateInput = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(80),
});

export type CreateKeyState = {
  error?: string;
  /** Plaintext key shown to the user exactly once after a successful create. */
  plaintext?: string;
  /** Display prefix that pairs with the plaintext for confirmation. */
  prefix?: string;
};

export async function createApiKeyAction(
  _prev: CreateKeyState,
  formData: FormData
): Promise<CreateKeyState> {
  const user = await requireUser();

  const parsed = CreateInput.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: "Project and key name are required." };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ownerId: user.id },
    select: { id: true },
  });
  if (!project) {
    return { error: "Project not found." };
  }

  const generated = generateApiKey();
  await prisma.apiKey.create({
    data: {
      projectId: project.id,
      name: parsed.data.name,
      keyHash: generated.keyHash,
      prefix: generated.prefix,
    },
  });

  revalidatePath("/settings/api-keys");
  return { plaintext: generated.plaintext, prefix: generated.prefix };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.apiKey.updateMany({
    where: {
      id,
      revokedAt: null,
      project: { ownerId: user.id },
    },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings/api-keys");
}
