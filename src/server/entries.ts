"use server";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { auth } from "@/auth";
import { EntryStatus, EntryType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";

const entryFormSchema = z.object({
  projectId: z.string().min(1, "请选择项目"),
  type: z.enum(EntryType, "请选择流水类型"),
  amountYuan: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "金额最多保留 2 位小数")
    .refine((value) => Number(value) > 0, "金额必须大于 0")
    .transform((value) => Math.round(Number(value) * 100)),
  description: z
    .string()
    .trim()
    .min(1, "描述不能为空")
    .max(200, "描述最多 200 个字"),
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择发生时间")
    .transform((value) => new Date(`${value}T00:00:00.000`))
    .refine((value) => !Number.isNaN(value.getTime()), "发生时间不合法"),
});

export type CreateEntryState = {
  success?: boolean;
  entryId?: string;
  error?: string;
};

type SessionUser = {
  id: string;
  role: string;
};

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

function createCuidLikeId() {
  return `c${randomBytes(12).toString("base64url").toLowerCase()}`;
}

function getProjectAccessWhere(projectId: string, user: SessionUser) {
  return {
    id: projectId,
    active: true,
    ...(user.role === "OWNER"
      ? {}
      : {
          allocations: {
            some: {
              shares: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        }),
  };
}

function getProjectListWhere(user: SessionUser) {
  return {
    active: true,
    ...(user.role === "OWNER"
      ? {}
      : {
          allocations: {
            some: {
              shares: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        }),
  };
}

async function findAccessibleProject(projectId: string, user: SessionUser) {
  return prisma.project.findFirst({
    where: getProjectAccessWhere(projectId, user),
    select: {
      id: true,
    },
  });
}

export async function createEntryAction(
  _prevState: CreateEntryState,
  formData: FormData
): Promise<CreateEntryState> {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "请先登录" };
  }

  const parsed = entryFormSchema.safeParse({
    projectId: formData.get("projectId"),
    type: formData.get("type"),
    amountYuan: formData.get("amountYuan"),
    description: formData.get("description"),
    occurredAt: formData.get("occurredAt"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "请检查表单内容",
    };
  }

  const project = await prisma.project.findUnique({
    where: {
      id: parsed.data.projectId,
    },
    select: {
      id: true,
      active: true,
    },
  });

  if (!project?.active) {
    return { error: "项目不存在" };
  }

  const hasProjectAccess = await findAccessibleProject(
    parsed.data.projectId,
    session.user
  );

  if (!hasProjectAccess) {
    return { error: "无权访问此项目" };
  }

  const evidence = formData.get("evidence");

  if (!isFile(evidence) || evidence.size === 0) {
    return { error: "请上传一张凭证图片" };
  }

  let savedEvidence: Awaited<ReturnType<typeof saveUploadedFile>>;

  try {
    savedEvidence = await saveUploadedFile(evidence, "evidences");
  } catch (error) {
    const message = error instanceof Error ? error.message : "凭证上传失败";

    return {
      error: message.includes("5MB") ? "图片必须 < 5MB" : message,
    };
  }

  const now = new Date();
  const entrySnapshot = {
    id: createCuidLikeId(),
    projectId: parsed.data.projectId,
    type: parsed.data.type,
    amountCents: parsed.data.amountYuan,
    description: parsed.data.description,
    occurredAt: parsed.data.occurredAt,
    status: EntryStatus.PENDING,
    createdById: session.user.id,
    approvedById: null,
    approvedAt: null,
    rejectedReason: null,
    reversedFromId: null,
    createdAt: now,
  };

  try {
    await prisma.$transaction([
      prisma.entry.create({
        data: entrySnapshot,
      }),
      prisma.evidence.create({
        data: {
          entryId: entrySnapshot.id,
          r2Key: savedEvidence.key,
          mimeType: savedEvidence.mime,
          sizeBytes: savedEvidence.size,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          entryId: entrySnapshot.id,
          eventType: "ENTRY_CREATED",
          payloadJson: JSON.stringify(entrySnapshot),
          actorId: session.user.id,
        },
      }),
    ]);
  } catch (error) {
    console.error("create entry failed", error);
    return { error: "流水创建失败" };
  }

  return {
    success: true,
    entryId: entrySnapshot.id,
  };
}

export async function getMyProjects() {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  return prisma.project.findMany({
    where: getProjectListWhere(session.user),
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getEntryDetail(entryId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.entry.findFirst({
    where: {
      id: entryId,
      ...(session.user.role === "OWNER"
        ? {}
        : {
            OR: [
              {
                createdById: session.user.id,
              },
              {
                project: {
                  allocations: {
                    some: {
                      shares: {
                        some: {
                          userId: session.user.id,
                        },
                      },
                    },
                  },
                },
              },
            ],
          }),
    },
    include: {
      evidences: true,
      createdBy: true,
      project: true,
      events: true,
    },
  });
}
