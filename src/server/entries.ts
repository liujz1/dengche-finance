"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { EntryStatus, EntryType } from "@/generated/prisma/enums";
import { parseShanghaiDateInput } from "@/lib/date";
import { prisma } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";

const MAX_ENTRY_AMOUNT_CENTS = 2_000_000_000;
const MAX_ENTRY_AMOUNT_MESSAGE = "单笔金额不能超过 2000 万元";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_EVIDENCE_FILES = 9;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const entryFormSchema = z.object({
  projectId: z.string().min(1, "请选择项目"),
  type: z.enum(EntryType, "请选择流水类型"),
  amountYuan: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "金额最多保留 2 位小数")
    .refine((value) => Number(value) > 0, "金额必须大于 0")
    .transform((value) => Math.round(Number(value) * 100))
    .refine(
      (cents) =>
        Number.isSafeInteger(cents) &&
        cents >= 1 &&
        cents <= MAX_ENTRY_AMOUNT_CENTS,
      MAX_ENTRY_AMOUNT_MESSAGE
    ),
  description: z
    .string()
    .trim()
    .min(1, "描述不能为空")
    .max(200, "描述最多 200 个字"),
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择发生时间")
    .transform(parseShanghaiDateInput)
    .refine((value) => !Number.isNaN(value.getTime()), "发生时间不合法"),
});

const entryIdSchema = z.string().min(1, "流水不存在");

const rejectEntrySchema = z.object({
  entryId: entryIdSchema,
  reason: z
    .string()
    .trim()
    .min(1, "原因不能为空")
    .max(200, "原因最多 200 个字"),
});

const reverseEntrySchema = z.object({
  entryId: entryIdSchema,
  reason: z.string().trim().min(1, "原因不能为空").max(200, "原因最多 200 个字"),
});

const deleteEntrySchema = z.object({
  entryId: entryIdSchema,
  reason: z.string().trim().min(1, "原因不能为空").max(200, "原因最多 200 个字"),
});

export type CreateEntryState = {
  success?: boolean;
  entryId?: string;
  projectId?: string;
  error?: string;
};

export type EntryApprovalState = {
  success?: boolean;
  error?: string;
};

export type ReverseEntryState = {
  success?: boolean;
  error?: string;
};

export type DeleteEntryState = {
  success?: boolean;
  projectId?: string;
  error?: string;
};

type SessionUser = {
  id: string;
  role: string;
};

type EntryEventSource = {
  id: string;
  projectId: string;
  type: EntryType;
  amountCents: number;
  description: string;
  occurredAt: Date;
  status: EntryStatus;
  createdById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  reversedFromId: string | null;
  createdAt: Date;
};

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

function validateEvidenceFiles(values: FormDataEntryValue[]) {
  const files = values.filter(isFile).filter((file) => file.size > 0);

  if (files.length < 1 || files.length > MAX_EVIDENCE_FILES) {
    return {
      error: "请上传 1~9 张凭证图片",
      files: [],
    };
  }

  if (files.some((file) => !ALLOWED_MIME_TYPES.has(file.type))) {
    return {
      error: "凭证必须是 jpeg、png、webp 或 heic 图片",
      files: [],
    };
  }

  if (files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
    return {
      error: "凭证图片不能超过 5MB",
      files: [],
    };
  }

  return {
    error: null,
    files,
  };
}

function createCuidLikeId() {
  return `c${randomBytes(12).toString("base64url").toLowerCase()}`;
}

function pendingEntryEventPayload(entry: EntryEventSource) {
  return {
    id: entry.id,
    projectId: entry.projectId,
    type: entry.type,
    amountCents: entry.amountCents,
    description: entry.description,
    occurredAt: entry.occurredAt,
    status: entry.status,
    createdById: entry.createdById,
    approvedById: entry.approvedById,
    approvedAt: entry.approvedAt,
    rejectedReason: entry.rejectedReason,
    reversedFromId: entry.reversedFromId,
    createdAt: entry.createdAt,
  };
}

function entrySnapshot(entry: EntryEventSource) {
  return pendingEntryEventPayload(entry);
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

  const evidenceResult = validateEvidenceFiles(formData.getAll("evidence"));

  if (evidenceResult.error) {
    return { error: evidenceResult.error };
  }

  let savedEvidences: Awaited<ReturnType<typeof saveUploadedFile>>[];

  try {
    savedEvidences = [];

    for (const evidence of evidenceResult.files) {
      savedEvidences.push(await saveUploadedFile(evidence, "evidences"));
    }
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
      ...savedEvidences.map((savedEvidence) =>
        prisma.evidence.create({
          data: {
            entryId: entrySnapshot.id,
            r2Key: savedEvidence.key,
            mimeType: savedEvidence.mime,
            sizeBytes: savedEvidence.size,
          },
        })
      ),
      prisma.ledgerEvent.create({
        data: {
          entryId: entrySnapshot.id,
          projectId: entrySnapshot.projectId,
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
    projectId: entrySnapshot.projectId,
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

export async function approveEntryAction(
  _prevState: EntryApprovalState,
  formData: FormData
): Promise<EntryApprovalState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以审核流水" };
  }

  const parsed = entryIdSchema.safeParse(formData.get("entryId"));

  if (!parsed.success) {
    return { error: "流水不存在" };
  }

  const existingEntry = await prisma.entry.findUnique({
    where: {
      id: parsed.data,
      status: EntryStatus.PENDING,
    },
  });

  if (!existingEntry) {
    return { error: "这条流水已被处理" };
  }

  const now = new Date();
  const updatedSnapshot = {
    ...pendingEntryEventPayload(existingEntry),
    status: EntryStatus.APPROVED,
    approvedById: session.user.id,
    approvedAt: now,
    rejectedReason: null,
  };

  try {
    await prisma.$transaction([
      prisma.entry.update({
        where: {
          id: existingEntry.id,
          status: EntryStatus.PENDING,
        },
        data: {
          status: EntryStatus.APPROVED,
          approvedById: session.user.id,
          approvedAt: now,
          rejectedReason: null,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          entryId: existingEntry.id,
          projectId: existingEntry.projectId,
          eventType: "ENTRY_APPROVED",
          payloadJson: JSON.stringify(updatedSnapshot),
          actorId: session.user.id,
        },
      }),
    ]);
  } catch (error) {
    console.error("approve entry failed", error);
    return { error: "审核通过失败" };
  }

  revalidatePath("/approvals");
  revalidatePath(`/projects/${existingEntry.projectId}`);

  return { success: true };
}

export async function rejectEntryAction(
  _prevState: EntryApprovalState,
  formData: FormData
): Promise<EntryApprovalState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以审核流水" };
  }

  const parsed = rejectEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "请填写驳回原因",
    };
  }

  const existingEntry = await prisma.entry.findUnique({
    where: {
      id: parsed.data.entryId,
      status: EntryStatus.PENDING,
    },
  });

  if (!existingEntry) {
    return { error: "这条流水已被处理" };
  }

  const updatedSnapshot = {
    ...pendingEntryEventPayload(existingEntry),
    status: EntryStatus.REJECTED,
    approvedById: session.user.id,
    approvedAt: null,
    rejectedReason: parsed.data.reason,
  };

  try {
    await prisma.$transaction([
      prisma.entry.update({
        where: {
          id: existingEntry.id,
          status: EntryStatus.PENDING,
        },
        data: {
          status: EntryStatus.REJECTED,
          approvedById: session.user.id,
          approvedAt: null,
          rejectedReason: parsed.data.reason,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          entryId: existingEntry.id,
          projectId: existingEntry.projectId,
          eventType: "ENTRY_REJECTED",
          payloadJson: JSON.stringify(updatedSnapshot),
          actorId: session.user.id,
        },
      }),
    ]);
  } catch (error) {
    console.error("reject entry failed", error);
    return { error: "驳回失败" };
  }

  revalidatePath("/approvals");
  revalidatePath(`/projects/${existingEntry.projectId}`);

  return { success: true };
}

export async function reverseEntryAction(
  _prevState: ReverseEntryState,
  formData: FormData
): Promise<ReverseEntryState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以反向冲销" };
  }

  const parsed = reverseEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "请检查输入" };
  }

  const original = await prisma.entry.findUnique({
    where: {
      id: parsed.data.entryId,
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      amountCents: true,
      description: true,
      status: true,
      reversedFromId: true,
    },
  });

  if (!original) {
    return { error: "流水不存在" };
  }

  if (original.status !== "APPROVED") {
    return { error: "只有已审核流水可以冲销" };
  }

  if (original.reversedFromId) {
    return { error: "已经是反向条, 不能再冲销" };
  }

  const now = new Date();
  const reverseId = createCuidLikeId();
  const reversalSnapshot = {
    id: reverseId,
    projectId: original.projectId,
    type: original.type,
    amountCents: -original.amountCents,
    description: `[冲销] ${original.description} — ${parsed.data.reason}`,
    occurredAt: now,
    status: EntryStatus.APPROVED,
    createdById: session.user.id,
    approvedById: session.user.id,
    approvedAt: now,
    rejectedReason: null,
    reversedFromId: original.id,
    createdAt: now,
  };

  try {
    await prisma.$transaction([
      prisma.entry.update({
        where: {
          id: original.id,
        },
        data: {
          status: "VOIDED",
        },
      }),
      prisma.entry.create({
        data: reversalSnapshot,
      }),
      prisma.ledgerEvent.create({
        data: {
          entryId: reversalSnapshot.id,
          projectId: reversalSnapshot.projectId,
          eventType: "ENTRY_CREATED",
          payloadJson: JSON.stringify({
            ...reversalSnapshot,
            originalEntryId: original.id,
            reversalReason: parsed.data.reason,
          }),
          actorId: session.user.id,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          entryId: original.id,
          projectId: original.projectId,
          eventType: "ENTRY_REVERSED",
          payloadJson: JSON.stringify({
            originalId: original.id,
            reverseId,
            reason: parsed.data.reason,
          }),
          actorId: session.user.id,
        },
      }),
    ]);
  } catch (error) {
    console.error("reverse entry failed", error);
    return { error: "反向冲销失败" };
  }

  revalidatePath(`/projects/${original.projectId}`);
  revalidatePath("/approvals");

  return { success: true };
}

export async function deleteEntryAction(
  _prevState: DeleteEntryState,
  formData: FormData
): Promise<DeleteEntryState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以删除流水" };
  }

  const parsed = deleteEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "请检查输入" };
  }

  const entry = await prisma.entry.findUnique({
    where: {
      id: parsed.data.entryId,
    },
    include: {
      reversal: { select: { id: true } },
      reversedFrom: { select: { id: true } },
    },
  });

  if (!entry) {
    return { error: "流水不存在" };
  }

  // 冲销配对：若这条流水属于一对冲销（它是被冲销的原始条，或它本身是冲销条），
  // 把整对一起删——只删一半会让账面对不上、审计链断裂。
  const idsToDelete = [entry.id];
  if (entry.reversal) {
    idsToDelete.push(entry.reversal.id);
  }
  if (entry.reversedFrom) {
    idsToDelete.push(entry.reversedFrom.id);
  }

  const entriesToDelete = await prisma.entry.findMany({
    where: { id: { in: idsToDelete } },
    include: {
      evidences: {
        select: { r2Key: true, mimeType: true, sizeBytes: true },
      },
    },
  });

  try {
    await prisma.$transaction([
      // 1. 为每条被删流水写 ENTRY_DELETED 留痕（含完整快照 + 凭证清单）
      ...entriesToDelete.map((item) =>
        prisma.ledgerEvent.create({
          data: {
            projectId: item.projectId,
            eventType: "ENTRY_DELETED",
            payloadJson: JSON.stringify({
              entry: entrySnapshot(item),
              evidences: item.evidences,
              reason: parsed.data.reason,
              actorId: session.user.id,
              pairedDelete: entriesToDelete.length > 1,
            }),
            actorId: session.user.id,
          },
        })
      ),
      // 2. 断开冲销条的自引用外键，否则删除时外键冲突
      prisma.entry.updateMany({
        where: { id: { in: idsToDelete }, reversedFromId: { not: null } },
        data: { reversedFromId: null },
      }),
      // 3. 历史事件 entryId 置空（payload 快照保留，审计内容不丢）
      prisma.ledgerEvent.updateMany({
        where: { entryId: { in: idsToDelete } },
        data: { entryId: null },
      }),
      // 4. 删凭证
      prisma.evidence.deleteMany({
        where: { entryId: { in: idsToDelete } },
      }),
      // 5. 删流水
      prisma.entry.deleteMany({
        where: { id: { in: idsToDelete } },
      }),
    ]);
  } catch (error) {
    console.error("delete entry failed", error);
    return { error: "删除流水失败" };
  }

  revalidatePath(`/projects/${entry.projectId}`);
  revalidatePath("/approvals");
  revalidatePath("/me");

  // 服务端跳转回项目页。不能 return success 让前端 router.push——
  // 流水被删后当前流水详情路由会刷新成 404 并卸载弹窗组件，
  // 前端跳转来不及执行。redirect() 在那之前短路（createProject 同款写法）。
  redirect(`/projects/${entry.projectId}`);
}
