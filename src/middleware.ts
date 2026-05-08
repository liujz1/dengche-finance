// Middleware 在 Edge Runtime 跑, 不能 import "@/auth" (那个 import prisma → node:path 爆错).
// 改用 auth.config.ts (edge-safe), 在这里实例化一个新的 auth() 给 middleware 用.

import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth?.user?.id) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);

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
