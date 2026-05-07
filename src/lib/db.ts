// Prisma client singleton
// 避免 Next.js hot-reload 时创建多个 PrismaClient 实例
//
// Prisma 7 重要变化：
// - client 生成到 src/generated/prisma/（按 schema.prisma 的 output）
// - 直连模式必须传 driver adapter
// - PrismaClient constructor 签名是 union：要么 adapter 要么 accelerateUrl
//
// 这里用 better-sqlite3 adapter（仿照 new-api 风格的零依赖本地数据库）

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  // Prisma 用 "file:./dev.db" 这种带前缀格式，
  // 但 better-sqlite3 lib 要纯路径 "./dev.db"——strip 前缀
  const url = databaseUrl.startsWith("file:")
    ? databaseUrl.slice(5)
    : databaseUrl;

  const adapter = new PrismaBetterSqlite3({ url });

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
