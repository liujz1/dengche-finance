"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { EntryStatus, EntryType, UserRole } from "@/generated/prisma/enums";
import { parseShanghaiDateInput } from "@/lib/date";
import { prisma } from "@/lib/db";

type AllocationShareInput = {
  userId: string;
  basisPoints: number;
};

type AllocationShareSnapshot = AllocationShareInput & {
  id: string;
  planId: string;
};

const allocationShareSchema = z.object({
  userId: z.string().min(1, "用户不存在"),
  basisPoints: z.coerce
    .number()
    .int("比例必须是整数万分比")
    .min(0, "比例不能小于 0%")
    .max(10000, "比例不能超过 100%"),
});

const allocationPlanSchema = z
  .object({
    projectId: z.string().min(1, "项目不存在"),
    effectiveFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择生效时间")
      .transform(parseShanghaiDateInput)
      .refine((value) => !Number.isNaN(value.getTime()), "生效时间不合法"),
    note: z
      .string()
      .trim()
      .max(500, "备注最多 500 个字")
      .optional()
      .transform((value) => (value ? value : null)),
    shares: z.array(allocationShareSchema).min(1, "至少需要一个分配人"),
  })
  .refine(
    (value) =>
      new Set(value.shares.map((share) => share.userId)).size ===
      value.shares.length,
    "分配人不能重复"
  )
  .refine(
    (value) =>
      value.shares.reduce((total, share) => total + share.basisPoints, 0) ===
      10000,
    "分配比例合计必须等于 100%"
  );

export type CreateAllocationPlanState = {
  success?: boolean;
  error?: string;
};

function createCuidLikeId() {
  return `c${randomBytes(12).toString("base64url").toLowerCase()}`;
}

function allocationPlanSnapshot(params: {
  id: string;
  projectId: string;
  effectiveFrom: Date;
  note: string | null;
  createdById: string;
  createdAt: Date;
  shares: AllocationShareSnapshot[];
}) {
  return {
    id: params.id,
    projectId: params.projectId,
    effectiveFrom: params.effectiveFrom,
    note: params.note,
    createdById: params.createdById,
    createdAt: params.createdAt,
    shares: params.shares.map((share) => ({
      id: share.id,
      planId: share.planId,
      userId: share.userId,
      basisPoints: share.basisPoints,
    })),
  };
}

export async function createAllocationPlanAction(
  _prevState: CreateAllocationPlanState,
  formData: FormData
): Promise<CreateAllocationPlanState> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.OWNER) {
    return { error: "只有老板可以录入分配方案" };
  }

  const shares = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("share:"))
    .map(([key, value]) => ({
      userId: key.slice("share:".length),
      basisPoints: value,
    }));

  const parsed = allocationPlanSchema.safeParse({
    projectId: formData.get("projectId"),
    effectiveFrom: formData.get("effectiveFrom"),
    note: formData.get("note"),
    shares,
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message === "分配比例合计必须等于 100%"
          ? "合计必须为 100%"
          : parsed.error.issues[0]?.message || "请检查分配方案",
    };
  }

  const [project, userCount] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id: parsed.data.projectId,
        active: true,
      },
      select: {
        id: true,
      },
    }),
    prisma.user.count({
      where: {
        id: {
          in: parsed.data.shares.map((share) => share.userId),
        },
        role: {
          in: [UserRole.OWNER, UserRole.PARTNER],
        },
      },
    }),
  ]);

  if (!project) {
    return { error: "项目不存在或已停用" };
  }

  if (userCount !== parsed.data.shares.length) {
    return { error: "分配人不存在或角色不允许" };
  }

  const now = new Date();
  const planId = createCuidLikeId();
  const planSnapshot = allocationPlanSnapshot({
    id: planId,
    projectId: parsed.data.projectId,
    effectiveFrom: parsed.data.effectiveFrom,
    note: parsed.data.note,
    createdById: session.user.id,
    createdAt: now,
    shares: parsed.data.shares.map((share) => ({
      id: createCuidLikeId(),
      planId,
      userId: share.userId,
      basisPoints: share.basisPoints,
    })),
  });

  try {
    await prisma.$transaction([
      prisma.allocationPlan.create({
        data: {
          id: planSnapshot.id,
          projectId: planSnapshot.projectId,
          effectiveFrom: planSnapshot.effectiveFrom,
          note: planSnapshot.note,
          createdById: planSnapshot.createdById,
          createdAt: planSnapshot.createdAt,
          shares: {
            create: planSnapshot.shares.map((share) => ({
              id: share.id,
              userId: share.userId,
              basisPoints: share.basisPoints,
            })),
          },
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          projectId: planSnapshot.projectId,
          eventType: "ALLOCATION_PLAN_CREATED",
          payloadJson: JSON.stringify(planSnapshot),
          actorId: session.user.id,
        },
      }),
    ]);
  } catch (error) {
    console.error("create allocation plan failed", error);
    return { error: "分配方案创建失败" };
  }

  revalidatePath("/allocations");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { success: true };
}

export async function getCurrentAllocation(projectId: string) {
  return prisma.allocationPlan.findFirst({
    where: {
      projectId,
      effectiveFrom: {
        lte: new Date(),
      },
    },
    include: {
      shares: {
        include: {
          user: true,
        },
        orderBy: {
          user: {
            createdAt: "asc",
          },
        },
      },
    },
    orderBy: [
      {
        effectiveFrom: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function calculatePartnerEarnings(
  projectId: string,
  userId: string
) {
  const [incomeSummary, expenseSummary, currentAllocation] = await Promise.all([
    prisma.entry.aggregate({
      where: {
        projectId,
        status: EntryStatus.APPROVED,
        type: EntryType.INCOME,
      },
      _sum: {
        amountCents: true,
      },
    }),
    prisma.entry.aggregate({
      where: {
        projectId,
        status: EntryStatus.APPROVED,
        type: {
          in: [EntryType.EXPENSE, EntryType.PROXY_PAY],
        },
      },
      _sum: {
        amountCents: true,
      },
    }),
    getCurrentAllocation(projectId),
  ]);

  if (!currentAllocation) {
    return 0;
  }

  const userShare = currentAllocation.shares.find(
    (share) => share.userId === userId
  );

  if (!userShare) {
    return 0;
  }

  const incomeCents = incomeSummary._sum.amountCents ?? 0;
  const expenseCents = expenseSummary._sum.amountCents ?? 0;
  const netProfitCents = incomeCents - expenseCents;

  return Math.round((netProfitCents * userShare.basisPoints) / 10000);
}
