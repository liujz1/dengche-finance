"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

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
      .transform((value) => new Date(`${value}T00:00:00.000`))
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
  error?: string;
};

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
      error: parsed.error.issues[0]?.message || "请检查分配方案",
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
    return { error: "分配人不存在" };
  }

  await prisma.allocationPlan.create({
    data: {
      projectId: parsed.data.projectId,
      effectiveFrom: parsed.data.effectiveFrom,
      note: parsed.data.note,
      createdById: session.user.id,
      shares: {
        create: parsed.data.shares.map((share) => ({
          userId: share.userId,
          basisPoints: share.basisPoints,
        })),
      },
    },
  });

  revalidatePath("/allocations");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect("/allocations");
}

