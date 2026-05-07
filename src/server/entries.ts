"use server";

import { redirect } from "next/navigation";
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
  error?: string;
};

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

async function canUseProject(projectId: string, userId: string, role: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      active: true,
      ...(role === "OWNER"
        ? {}
        : {
            allocations: {
              some: {
                shares: {
                  some: {
                    userId,
                  },
                },
              },
            },
          }),
    },
    select: {
      id: true,
    },
  });

  return Boolean(project);
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

  const evidence = formData.get("evidence");

  if (!isFile(evidence) || evidence.size === 0) {
    return { error: "请上传一张凭证图片" };
  }

  const hasProjectAccess = await canUseProject(
    parsed.data.projectId,
    session.user.id,
    session.user.role
  );

  if (!hasProjectAccess) {
    return { error: "你不能给这个项目录入流水" };
  }

  let savedEvidence: Awaited<ReturnType<typeof saveUploadedFile>>;

  try {
    savedEvidence = await saveUploadedFile(evidence, "evidences");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "凭证上传失败",
    };
  }

  const entry = await prisma.entry.create({
    data: {
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      amountCents: parsed.data.amountYuan,
      description: parsed.data.description,
      occurredAt: parsed.data.occurredAt,
      status: EntryStatus.PENDING,
      createdById: session.user.id,
      evidences: {
        create: {
          r2Key: savedEvidence.key,
          mimeType: savedEvidence.mime,
          sizeBytes: savedEvidence.size,
        },
      },
      events: {
        create: {
          eventType: "ENTRY_CREATED",
          payloadJson: JSON.stringify({
            projectId: parsed.data.projectId,
            type: parsed.data.type,
            amountCents: parsed.data.amountYuan,
            description: parsed.data.description,
            evidenceKey: savedEvidence.key,
          }),
          actorId: session.user.id,
        },
      },
    },
    select: {
      projectId: true,
    },
  });

  redirect(`/projects/${entry.projectId}`);
}
