"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const ServiceInput = z.object({
  projectId: z.string().min(1),
  name: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-_]*$/i, {
      message: "Use letters, numbers, dashes, or underscores.",
    }),
  environment: z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT"]),
});

export type CreateServiceState = {
  error?: string;
  values?: { name?: string; projectId?: string; environment?: string };
};

export async function createServiceAction(
  _prev: CreateServiceState,
  formData: FormData
): Promise<CreateServiceState> {
  const user = await requireUser();

  const rawValues = {
    projectId: String(formData.get("projectId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    environment: String(formData.get("environment") ?? ""),
  };

  const parsed = ServiceInput.safeParse(rawValues);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid service configuration.",
      values: rawValues,
    };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ownerId: user.id },
    select: { id: true },
  });
  if (!project) {
    return { error: "Project not found.", values: rawValues };
  }

  const existing = await prisma.service.findUnique({
    where: {
      projectId_name: { projectId: project.id, name: parsed.data.name },
    },
    select: { id: true },
  });
  if (existing) {
    return {
      error: `A service named '${parsed.data.name}' already exists in this project.`,
      values: rawValues,
    };
  }

  const service = await prisma.service.create({
    data: {
      projectId: project.id,
      name: parsed.data.name,
      environment: parsed.data.environment,
    },
    select: { id: true },
  });

  revalidatePath("/services");
  redirect(`/services/${service.id}`);
}
