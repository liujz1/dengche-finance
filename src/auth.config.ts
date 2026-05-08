// Edge-safe auth config (middleware 用)
// 不 import prisma, bcryptjs, 任何 node:* 模块
// providers 只声明空数组, 真正的 Credentials provider 在 auth.ts 里加
//
// 为什么拆: Next.js middleware 在 Edge Runtime 跑, 不支持 node:path / node:fs / 等
// Node core modules. Prisma client 用 node:path → 不能进 middleware bundle.
//
// 标准 NextAuth v5 模式: auth.config (edge) + auth (node)

import type { NextAuthConfig, DefaultSession } from "next-auth";

import type { UserRole } from "@/generated/prisma/enums";

type LedgerToken = {
  id?: string;
  role?: UserRole;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      const ledgerToken = token as LedgerToken;

      if (user) {
        ledgerToken.id = user.id;
        ledgerToken.role = user.role as UserRole;
      }

      return token;
    },
    session({ session, token }) {
      const ledgerToken = token as LedgerToken;

      if (session.user && token.sub && ledgerToken.role) {
        session.user.id = token.sub;
        session.user.role = ledgerToken.role;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
