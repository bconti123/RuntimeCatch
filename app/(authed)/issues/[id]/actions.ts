"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { IssueStatus } from "@/prisma/generated/client/client";

export async function setIssueStatus(issueId: string, status: IssueStatus) {
  await prisma.issue.update({
    where: { id: issueId },
    data: { status },
  });

  if (status === "RESOLVED") {
    await prisma.runtimeEvent.updateMany({
      where: { issueId },
      data: { resolved: true },
    });
  } else if (status === "OPEN") {
    await prisma.runtimeEvent.updateMany({
      where: { issueId },
      data: { resolved: false },
    });
  }

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
  revalidatePath("/");
}
