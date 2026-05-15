"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "项目名不能为空")
    .max(50, "项目名最多 50 个字"),
  description: z
    .string()
    .trim()
    .max(500, "描述最多 500 个字")
    .optional()
    .transform((value) => (value ? value : null)),
});

export type CreateProjectState = {
  error?: string;
  fieldErrors?: {
    name?: string[];
    description?: string[];
  };
};

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以新建项目" };
  }

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return {
      error: "请检查表单内容",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: parsed.data,
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        createdAt: true,
      },
    });

    await tx.ledgerEvent.create({
      data: {
        projectId: created.id,
        eventType: "PROJECT_CREATED",
        payloadJson: JSON.stringify(created),
        actorId: session.user.id,
      },
    });

    return created;
  });

  redirect(`/projects/${project.id}`);
}

export async function getMyProjects() {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  const isOwner = session.user.role === "OWNER";

  return prisma.project.findMany({
    where: {
      active: true,
      ...(isOwner
        ? {}
        : {
            allocations: {
              some: {
                shares: {
                  some: {
                    userId: session.user.id,
                  },
                },
              },
            },
          }),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
