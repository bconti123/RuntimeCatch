"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";

const Credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, passwordHash: true },
  });
  // Always run verifyPassword to avoid trivial timing oracle on user existence.
  const ok = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : false;
  if (!user || !ok) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  redirect("/");
}
