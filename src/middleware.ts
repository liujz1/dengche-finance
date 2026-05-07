import { NextResponse } from "next/server";

import { auth } from "@/auth";

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
