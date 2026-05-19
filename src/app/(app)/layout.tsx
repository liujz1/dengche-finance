import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { auth, signOut } from "@/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { EntryStatus } from "@/generated/prisma/enums";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

function roleLabel(role: string) {
  return role === "OWNER" ? "老板" : "合伙人";
}

function userInitial(name?: string | null) {
  return name?.trim().slice(0, 1).toUpperCase() || "账";
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const isOwner = session.user.role === "OWNER";
  const [dbUser, rejectedEntryCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, role: true },
    }),
    isOwner
      ? Promise.resolve(0)
      : prisma.entry.count({
          where: {
            createdById: session.user.id,
            status: EntryStatus.REJECTED,
          },
        }),
  ]);
  const displayName = dbUser?.name ?? session.user.name ?? null;
  const navItems = [
    { href: "/projects", label: "项目", visible: true },
    {
      href: "/me",
      label: "我的回报",
      visible: true,
      rejectedEntryCount,
    },
    { href: "/approvals", label: "审核", visible: isOwner },
    { href: "/allocations", label: "分配", visible: isOwner },
    { href: "/admin/users", label: "用户", visible: isOwner },
  ];

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex min-h-14 items-center gap-4 px-4">
          <Link
            href="/projects"
            className="shrink-0 text-base font-semibold tracking-normal"
          >
            项目损益账本
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "gap-1.5 text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={
                    item.rejectedEntryCount
                      ? `${item.label}，${item.rejectedEntryCount} 笔被驳回流水`
                      : item.label
                  }
                >
                  <span>{item.label}</span>
                  {item.rejectedEntryCount ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">
                      {item.rejectedEntryCount}
                    </span>
                  ) : null}
                </Link>
              ))}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-10 max-w-[220px] gap-2 px-2"
              )}
            >
              <Avatar size="sm">
                <AvatarFallback>{userInitial(displayName)}</AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
                <span className="max-w-24 truncate text-sm font-medium">
                  {displayName || "未命名用户"}
                </span>
              </span>
              <Badge variant={isOwner ? "default" : "secondary"}>
                {roleLabel(session.user.role)}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-foreground">
                      {displayName || "未命名用户"}
                    </span>
                    <span>{roleLabel(session.user.role)}</span>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/me" />}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span>我的回报</span>
                  {rejectedEntryCount ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">
                      {rejectedEntryCount}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<div />}>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                  className="w-full"
                >
                  <button
                    type="submit"
                    className="flex w-full items-center gap-1.5 text-left"
                  >
                    <LogOutIcon className="size-4" />
                    退出
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">{children}</main>
      <Toaster richColors />
    </div>
  );
}
