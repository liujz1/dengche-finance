import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EntryStatus, EntryType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCents(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function signedAmountCents(type: EntryType, amountCents: number) {
  if (type === EntryType.INCOME) {
    return amountCents;
  }

  if (type === EntryType.EXPENSE || type === EntryType.PROXY_PAY) {
    return -amountCents;
  }

  return 0;
}

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const isOwner = session.user.role === "OWNER";
  const projects = await prisma.project.findMany({
    where: {
      active: true,
      ...(isOwner
        ? {}
        : {
            allocations: {
              some: {
                shares: {
                  some: {
                    userId: session.user.id,
                  },
                },
              },
            },
          }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      entries: {
        where: {
          status: {
            in: [EntryStatus.APPROVED, EntryStatus.PENDING],
          },
        },
        select: {
          type: true,
          amountCents: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const projectCards = projects.map((project) => {
    const approvedProfitCents = project.entries
      .filter((entry) => entry.status === EntryStatus.APPROVED)
      .reduce(
        (total, entry) => total + signedAmountCents(entry.type, entry.amountCents),
        0
      );

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      approvedProfitCents,
      entryCount: project.entries.length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">项目</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看已参与项目的当前盈亏和流水状态
          </p>
        </div>
        {isOwner ? (
          <Link
            href="/projects/new"
            className={cn(buttonVariants({ size: "lg" }), "self-start")}
          >
            + 新建项目
          </Link>
        ) : null}
      </div>

      {projectCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectCards.map((project) => (
            <Card key={project.id} className="transition-colors hover:bg-muted/20">
              <CardHeader>
                <CardTitle className="text-xl">{project.name}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-10">
                  {project.description || "暂无描述"}
                </CardDescription>
                <CardAction>
                  <Badge
                    variant={
                      project.approvedProfitCents >= 0 ? "secondary" : "destructive"
                    }
                  >
                    {project.approvedProfitCents >= 0 ? "盈利" : "亏损"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">当前盈亏</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCents(project.approvedProfitCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">流水数</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {project.entryCount}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Link
                  href={`/projects/${project.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full"
                  )}
                >
                  查看项目
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            还没有项目, 老板可以新建一个
          </CardContent>
        </Card>
      )}
    </div>
  );
}
