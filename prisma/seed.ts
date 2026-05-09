import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  EntryStatus,
  EntryType,
  UserRole,
} from "../src/generated/prisma/enums";

const SEED = {
  ownerId: "seed_user_owner",
  partnerAId: "seed_user_partner_a",
  partnerBId: "seed_user_partner_b",
  image2ProjectId: "seed_project_image2",
  windsurfProjectId: "seed_project_windsurf",
  image2PlanId: "seed_plan_image2_initial",
  windsurfPlanId: "seed_plan_windsurf_initial",
} as const;

const entrySeeds = [
  {
    id: "seed_entry_image2_taobao_income",
    projectId: SEED.image2ProjectId,
    type: EntryType.INCOME,
    amountCents: 88800,
    description: "淘宝收款 ¥888",
    daysAgo: 26,
  },
  {
    id: "seed_entry_image2_adobe_expense",
    projectId: SEED.image2ProjectId,
    type: EntryType.EXPENSE,
    amountCents: 12000,
    description: "Adobe 账号采购 ¥120",
    daysAgo: 19,
  },
  {
    id: "seed_entry_windsurf_account_expense",
    projectId: SEED.windsurfProjectId,
    type: EntryType.EXPENSE,
    amountCents: 29900,
    description: "windsurf 号采购 ¥299",
    daysAgo: 12,
  },
  {
    id: "seed_entry_windsurf_family_income",
    projectId: SEED.windsurfProjectId,
    type: EntryType.INCOME,
    amountCents: 5000,
    description: "家人转账 ¥50",
    daysAgo: 5,
  },
  {
    id: "seed_entry_image2_pending_for_test",
    projectId: SEED.image2ProjectId,
    type: EntryType.EXPENSE,
    amountCents: 9900,
    description: "测试待审一笔 ¥99",
    daysAgo: 1,
  },
] as const;

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const url = databaseUrl.startsWith("file:")
    ? databaseUrl.slice(5)
    : databaseUrl;
  const adapter = new PrismaBetterSqlite3({ url });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function eventPayload(input: {
  entryId: string;
  eventType: "ENTRY_CREATED" | "ENTRY_APPROVED";
  status: EntryStatus;
  description: string;
  amountCents: number;
}) {
  return JSON.stringify({
    seed: true,
    entryId: input.entryId,
    eventType: input.eventType,
    status: input.status,
    description: input.description,
    amountCents: input.amountCents,
  });
}

const prisma = createPrismaClient();

async function main() {
  const now = new Date();
  const effectiveFrom = daysAgo(30);

  // 👤 固定三位内部账号；email upsert，重复跑不会创建重复用户。
  const [owner, partnerA, partnerB] = await Promise.all([
    prisma.user.upsert({
      where: { email: "boss@dengche.local" },
      update: {
        id: SEED.ownerId,
        name: "老板",
        role: UserRole.OWNER,
        passwordHash: await hash("boss123456", 10),
      },
      create: {
        id: SEED.ownerId,
        email: "boss@dengche.local",
        name: "老板",
        role: UserRole.OWNER,
        passwordHash: await hash("boss123456", 10),
      },
    }),
    prisma.user.upsert({
      where: { email: "partner-a@dengche.local" },
      update: {
        id: SEED.partnerAId,
        name: "合伙人 A",
        role: UserRole.PARTNER,
        passwordHash: await hash("partnera123", 10),
      },
      create: {
        id: SEED.partnerAId,
        email: "partner-a@dengche.local",
        name: "合伙人 A",
        role: UserRole.PARTNER,
        passwordHash: await hash("partnera123", 10),
      },
    }),
    prisma.user.upsert({
      where: { email: "partner-b@dengche.local" },
      update: {
        id: SEED.partnerBId,
        name: "合伙人 B",
        role: UserRole.PARTNER,
        passwordHash: await hash("partnerb123", 10),
      },
      create: {
        id: SEED.partnerBId,
        email: "partner-b@dengche.local",
        name: "合伙人 B",
        role: UserRole.PARTNER,
        passwordHash: await hash("partnerb123", 10),
      },
    }),
  ]);

  // 📁 固定项目 id；schema 里项目名不唯一，所以用 id 保证幂等。
  await Promise.all([
    prisma.project.upsert({
      where: { id: SEED.image2ProjectId },
      update: {
        name: "image2 (Adobe 反代生图)",
        description: "淘宝/微信/网站 三渠道收款 + Adobe 账号采购成本",
        active: true,
      },
      create: {
        id: SEED.image2ProjectId,
        name: "image2 (Adobe 反代生图)",
        description: "淘宝/微信/网站 三渠道收款 + Adobe 账号采购成本",
      },
    }),
    prisma.project.upsert({
      where: { id: SEED.windsurfProjectId },
      update: {
        name: "windsurf (Pro 号家人自用 + 服务器化)",
        description: "号采购 + 服务器 + 测试成本",
        active: true,
      },
      create: {
        id: SEED.windsurfProjectId,
        name: "windsurf (Pro 号家人自用 + 服务器化)",
        description: "号采购 + 服务器 + 测试成本",
      },
    }),
  ]);

  // 📊 分配方案连带重写 shares，确保重复跑后比例仍然准确。
  await prisma.allocationPlan.upsert({
    where: { id: SEED.image2PlanId },
    update: {
      effectiveFrom,
      note: "Seed 示例分配：老板 60%，合伙人 A 25%，合伙人 B 15%",
      createdById: owner.id,
      shares: {
        deleteMany: {},
        create: [
          { userId: owner.id, basisPoints: 6000 },
          { userId: partnerA.id, basisPoints: 2500 },
          { userId: partnerB.id, basisPoints: 1500 },
        ],
      },
    },
    create: {
      id: SEED.image2PlanId,
      projectId: SEED.image2ProjectId,
      effectiveFrom,
      note: "Seed 示例分配：老板 60%，合伙人 A 25%，合伙人 B 15%",
      createdById: owner.id,
      shares: {
        create: [
          { userId: owner.id, basisPoints: 6000 },
          { userId: partnerA.id, basisPoints: 2500 },
          { userId: partnerB.id, basisPoints: 1500 },
        ],
      },
    },
  });

  await prisma.allocationPlan.upsert({
    where: { id: SEED.windsurfPlanId },
    update: {
      effectiveFrom,
      note: "Seed 示例分配：老板 70%，合伙人 A 30%",
      createdById: owner.id,
      shares: {
        deleteMany: {},
        create: [
          { userId: owner.id, basisPoints: 7000 },
          { userId: partnerA.id, basisPoints: 3000 },
        ],
      },
    },
    create: {
      id: SEED.windsurfPlanId,
      projectId: SEED.windsurfProjectId,
      effectiveFrom,
      note: "Seed 示例分配：老板 70%，合伙人 A 30%",
      createdById: owner.id,
      shares: {
        create: [
          { userId: owner.id, basisPoints: 7000 },
          { userId: partnerA.id, basisPoints: 3000 },
        ],
      },
    },
  });

  // 🧾 示例流水全部已审核，方便首页和趋势图直接有可见数据。
  for (const entrySeed of entrySeeds) {
    const isPending = entrySeed.id.includes("pending");
    const occurredAt = daysAgo(entrySeed.daysAgo);

    await prisma.entry.upsert({
      where: { id: entrySeed.id },
      update: {
        projectId: entrySeed.projectId,
        type: entrySeed.type,
        amountCents: entrySeed.amountCents,
        description: entrySeed.description,
        occurredAt,
        status: isPending ? EntryStatus.PENDING : EntryStatus.APPROVED,
        createdById: owner.id,
        approvedById: isPending ? null : owner.id,
        approvedAt: isPending ? null : now,
      },
      create: {
        id: entrySeed.id,
        projectId: entrySeed.projectId,
        type: entrySeed.type,
        amountCents: entrySeed.amountCents,
        description: entrySeed.description,
        occurredAt,
        status: isPending ? EntryStatus.PENDING : EntryStatus.APPROVED,
        createdById: owner.id,
        approvedById: isPending ? null : owner.id,
        approvedAt: isPending ? null : now,
      },
    });

    await prisma.ledgerEvent.upsert({
      where: { id: `${entrySeed.id}_created` },
      update: {
        entryId: entrySeed.id,
        eventType: "ENTRY_CREATED",
        payloadJson: eventPayload({
          entryId: entrySeed.id,
          eventType: "ENTRY_CREATED",
          status: EntryStatus.PENDING,
          description: entrySeed.description,
          amountCents: entrySeed.amountCents,
        }),
        actorId: owner.id,
        occurredAt,
      },
      create: {
        id: `${entrySeed.id}_created`,
        entryId: entrySeed.id,
        eventType: "ENTRY_CREATED",
        payloadJson: eventPayload({
          entryId: entrySeed.id,
          eventType: "ENTRY_CREATED",
          status: EntryStatus.PENDING,
          description: entrySeed.description,
          amountCents: entrySeed.amountCents,
        }),
        actorId: owner.id,
        occurredAt,
      },
    });

    if (!isPending) {
      await prisma.ledgerEvent.upsert({
        where: { id: `${entrySeed.id}_approved` },
        update: {
          entryId: entrySeed.id,
          eventType: "ENTRY_APPROVED",
          payloadJson: eventPayload({
            entryId: entrySeed.id,
            eventType: "ENTRY_APPROVED",
            status: EntryStatus.APPROVED,
            description: entrySeed.description,
            amountCents: entrySeed.amountCents,
          }),
          actorId: owner.id,
          occurredAt: new Date(occurredAt.getTime() + 60 * 60 * 1000),
        },
        create: {
          id: `${entrySeed.id}_approved`,
          entryId: entrySeed.id,
          eventType: "ENTRY_APPROVED",
          payloadJson: eventPayload({
            entryId: entrySeed.id,
            eventType: "ENTRY_APPROVED",
            status: EntryStatus.APPROVED,
            description: entrySeed.description,
            amountCents: entrySeed.amountCents,
          }),
          actorId: owner.id,
          occurredAt: new Date(occurredAt.getTime() + 60 * 60 * 1000),
        },
      });
    }
  }

  const [userCount, projectCount, entryCount, planCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.entry.count(),
    prisma.allocationPlan.count(),
  ]);

  console.log("✅ Seed 完成");
  console.log(
    `👤 users=${userCount} 📁 projects=${projectCount} 🧾 entries=${entryCount} 📊 plans=${planCount}`,
  );
  console.log("🔑 boss@dengche.local / boss123456");
}

main()
  .catch((error) => {
    console.error("❌ Seed 失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
