// Middleware 在 Edge Runtime 跑, 不能 import "@/auth" (那个 import prisma → node:path 爆错).
// 改用 auth.config.ts (edge-safe), 在这里实例化一个新的 auth() 给 middleware 用.

import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth?.user?.id) {
    const loginUrl = new URL("/login", req.nextUrl);
    // 用相对路径做 callbackUrl, 避免 NextAuth wrap 后 req.nextUrl.href 误用 localhost host
    const relativeCallback = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", relativeCallback);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/projects/:path*",
    "/entries/:path*",
    "/approvals/:path*",
    "/allocations/:path*",
    "/me/:path*",
  ],
};
