// Prisma client singleton
// 避免 Next.js hot-reload 时创建多个 PrismaClient 实例
//
// Prisma 7 重要变化：
// - client 生成到 src/generated/prisma/（按 schema.prisma 的 output）
// - 直连模式必须传 driver adapter（@prisma/adapter-pg）
// - PrismaClient constructor 签名是 union：要么 adapter 要么 accelerateUrl

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in.",
    );
  }

  const adapter = new PrismaPg(databaseUrl);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
