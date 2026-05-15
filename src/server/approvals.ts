"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { EntryStatus, EntryType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

const entryIdSchema = z.string().min(1, "流水不存在");

const reasonSchema = z
  .string()
  .trim()
  .min(1, "原因不能为空")
  .max(200, "原因最多 200 个字");

export type ApprovalActionResult = {
  success?: boolean;
  error?: string;
};

type EntrySnapshot = {
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

function snapshotEntry(entry: EntrySnapshot) {
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

function makeEventPayload(params: {
  actorId: string;
  before?: EntrySnapshot;
  after?: EntrySnapshot;
  reversal?: EntrySnapshot;
  reason?: string;
}) {
  return {
    actorId: params.actorId,
    before: params.before ? snapshotEntry(params.before) : null,
    after: params.after ? snapshotEntry(params.after) : null,
    reversal: params.reversal ? snapshotEntry(params.reversal) : null,
    reason: params.reason ?? null,
  };
}

async function requireOwner() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "请先登录" };
  }

  if (session.user.role !== "OWNER") {
    return { error: "只有老板可以操作流水审核" };
  }

  return { userId: session.user.id };
}

export async function approveEntryAction(
  entryId: string
): Promise<ApprovalActionResult> {
  const owner = await requireOwner();

  if ("error" in owner) {
    return { error: owner.error };
  }

  const parsedEntryId = entryIdSchema.safeParse(entryId);

  if (!parsedEntryId.success) {
    return { error: parsedEntryId.error.issues[0]?.message || "流水不存在" };
  }

  const entry = await prisma.entry.findUnique({
    where: {
      id: parsedEntryId.data,
    },
  });

  if (!entry) {
    return { error: "流水不存在" };
  }

  if (entry.status !== EntryStatus.PENDING) {
    return { error: "只有待审核流水可以通过" };
  }

  const now = new Date();
  const updatedEntry = {
    ...snapshotEntry(entry),
    status: EntryStatus.APPROVED,
    approvedById: owner.userId,
    approvedAt: now,
    rejectedReason: null,
  };

  try {
    await prisma.$transaction([
      prisma.entry.update({
        where: {
          id: entry.id,
          status: EntryStatus.PENDING,
        },
        data: {
          status: EntryStatus.APPROVED,
          approvedById: owner.userId,
          approvedAt: now,
          rejectedReason: null,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          entryId: entry.id,
          projectId: entry.projectId,
          eventType: "ENTRY_APPROVED",
          payloadJson: JSON.stringify(
            makeEventPayload({
              actorId: owner.userId,
              before: entry,
              after: updatedEntry,
            })
          ),
          actorId: owner.userId,
        },
      }),
    ]);
  } catch (error) {
    console.error("approve entry failed", error);
    return { error: "审核通过失败" };
  }

  revalidatePath("/approvals");
  revalidatePath(`/projects/${entry.projectId}`);

  return { success: true };
}

export async function rejectEntryAction(
  entryId: string,
  reason: string
): Promise<ApprovalActionResult> {
  const owner = await requireOwner();

  if ("error" in owner) {
    return { error: owner.error };
  }

  const parsedEntryId = entryIdSchema.safeParse(entryId);
  const parsedReason = reasonSchema.safeParse(reason);

  if (!parsedEntryId.success) {
    return { error: parsedEntryId.error.issues[0]?.message || "流水不存在" };
  }

  if (!parsedReason.success) {
    return { error: parsedReason.error.issues[0]?.message || "请填写驳回原因" };
  }

  const entry = await prisma.entry.findUnique({
    where: {
      id: parsedEntryId.data,
    },
  });

  if (!entry) {
    return { error: "流水不存在" };
  }

  if (entry.status !== EntryStatus.PENDING) {
    return { error: "只有待审核流水可以驳回" };
  }

  const now = new Date();
  const updatedEntry = {
    ...snapshotEntry(entry),
    status: EntryStatus.REJECTED,
    approvedById: owner.userId,
    approvedAt: now,
    rejectedReason: parsedReason.data,
  };

  try {
    await prisma.$transaction([
      prisma.entry.update({
        where: {
          id: entry.id,
          status: EntryStatus.PENDING,
        },
        data: {
          status: EntryStatus.REJECTED,
          approvedById: owner.userId,
          approvedAt: now,
          rejectedReason: parsedReason.data,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          entryId: entry.id,
          projectId: entry.projectId,
          eventType: "ENTRY_REJECTED",
          payloadJson: JSON.stringify(
            makeEventPayload({
              actorId: owner.userId,
              before: entry,
              after: updatedEntry,
              reason: parsedReason.data,
            })
          ),
          actorId: owner.userId,
        },
      }),
    ]);
  } catch (error) {
    console.error("reject entry failed", error);
    return { error: "驳回失败" };
  }

  revalidatePath("/approvals");
  revalidatePath(`/projects/${entry.projectId}`);

  return { success: true };
}

export async function reverseEntryAction(
  entryId: string,
  reason: string
): Promise<ApprovalActionResult> {
  const owner = await requireOwner();

  if ("error" in owner) {
    return { error: owner.error };
  }

  const parsedEntryId = entryIdSchema.safeParse(entryId);
  const parsedReason = reasonSchema.safeParse(reason);

  if (!parsedEntryId.success) {
    return { error: parsedEntryId.error.issues[0]?.message || "流水不存在" };
  }

  if (!parsedReason.success) {
    return { error: parsedReason.error.issues[0]?.message || "请填写冲销原因" };
  }

  const entry = await prisma.entry.findUnique({
    where: {
      id: parsedEntryId.data,
    },
    include: {
      reversal: true,
    },
  });

  if (!entry) {
    return { error: "流水不存在" };
  }

  if (entry.status !== EntryStatus.APPROVED) {
    return { error: "只有已通过流水可以反向冲销" };
  }

  if (entry.reversal) {
    return { error: "这条流水已经冲销过" };
  }

  const now = new Date();
  const voidedEntry = {
    ...snapshotEntry(entry),
    status: EntryStatus.VOIDED,
  };
  const reversalDescription = `[反向冲销] ${entry.description} (原因: ${parsedReason.data})`;

  try {
    const reversalEntry = await prisma.$transaction(async (tx) => {
      const updatedOriginal = await tx.entry.update({
        where: {
          id: entry.id,
          status: EntryStatus.APPROVED,
        },
        data: {
          status: EntryStatus.VOIDED,
        },
      });
      const createdReversal = await tx.entry.create({
        data: {
          projectId: entry.projectId,
          type: entry.type,
          amountCents: -entry.amountCents,
          occurredAt: now,
          description: reversalDescription,
          status: EntryStatus.APPROVED,
          reversedFromId: entry.id,
          createdById: owner.userId,
          approvedById: owner.userId,
          approvedAt: now,
        },
      });

      await tx.ledgerEvent.create({
        data: {
          entryId: entry.id,
          projectId: entry.projectId,
          eventType: "ENTRY_REVERSED",
          payloadJson: JSON.stringify(
            makeEventPayload({
              actorId: owner.userId,
              before: entry,
              after: updatedOriginal,
              reversal: createdReversal,
              reason: parsedReason.data,
            })
          ),
          actorId: owner.userId,
        },
      });

      return createdReversal;
    });

    revalidatePath("/approvals");
    revalidatePath(`/projects/${entry.projectId}`);
    revalidatePath(`/projects/${reversalEntry.projectId}`);
  } catch (error) {
    console.error("reverse entry failed", error);
    return { error: "反向冲销失败" };
  }

  return { success: true };
}
