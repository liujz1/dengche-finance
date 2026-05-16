"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

export type UpdateProjectState = CreateProjectState & {
  success?: boolean;
  projectId?: string;
};

export type ProjectArchiveState = {
  success?: boolean;
  error?: string;
};

const archiveProjectSchema = z.object({
  id: z.string().min(1, "项目不存在"),
  archived: z.enum(["true", "false"]).transform((value) => value === "true"),
});

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

export async function updateProjectAction(
  _prevState: UpdateProjectState,
  formData: FormData
): Promise<UpdateProjectState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以编辑项目" };
  }

  const projectId = formData.get("id");
  if (typeof projectId !== "string" || projectId.length === 0) {
    return { error: "项目不存在" };
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

  const current = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      createdAt: true,
    },
  });

  if (!current) {
    return { error: "项目不存在" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: {
          id: projectId,
        },
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
          projectId: updated.id,
          eventType: "PROJECT_UPDATED",
          payloadJson: JSON.stringify({
            before: current,
            after: updated,
            changedFields: {
              name: current.name !== updated.name,
              description: current.description !== updated.description,
            },
          }),
          actorId: session.user.id,
        },
      });
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/edit`);
    return { success: true, projectId };
  } catch (error) {
    console.error("update project failed", error);
    return { error: "保存失败" };
  }
}

export async function setProjectArchivedAction(
  _prevState: ProjectArchiveState,
  formData: FormData
): Promise<ProjectArchiveState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以归档项目" };
  }

  const parsed = archiveProjectSchema.safeParse({
    id: formData.get("id"),
    archived: formData.get("archived"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "项目不存在" };
  }

  const current = await prisma.project.findUnique({
    where: {
      id: parsed.data.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      createdAt: true,
    },
  });

  if (!current) {
    return { error: "项目不存在" };
  }

  const nextActive = !parsed.data.archived;

  if (current.active === nextActive) {
    return { success: true };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: {
          id: current.id,
        },
        data: {
          active: nextActive,
        },
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
          projectId: updated.id,
          eventType: parsed.data.archived
            ? "PROJECT_ARCHIVED"
            : "PROJECT_RESTORED",
          payloadJson: JSON.stringify({
            before: current,
            after: updated,
            actorId: session.user.id,
            projectId: updated.id,
          }),
          actorId: session.user.id,
        },
      });
    });
  } catch (error) {
    console.error("set project archived failed", error);
    return { error: parsed.data.archived ? "归档失败" : "恢复失败" };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${current.id}`);

  return { success: true };
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
