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
import { signedProfitAmountCents } from "@/lib/amount";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { ProjectArchiveDialog } from "./[id]/project-archive-dialog";

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCents(cents: number) {
  return moneyFormatter.format(cents / 100);
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const isOwner = session.user.role === "OWNER";
  const { archived } = await searchParams;
  const showArchived = isOwner && archived === "1";
  const projects = await prisma.project.findMany({
    where: {
      active: showArchived ? false : true,
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
      active: true,
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
        (total, entry) => total + signedProfitAmountCents(entry),
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
          <div className="flex flex-wrap gap-2 self-start">
            <Link
              href={showArchived ? "/projects" : "/projects?archived=1"}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              {showArchived ? "查看活跃项目" : "查看已归档"}
            </Link>
            <Link
              href="/projects/new"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              + 新建项目
            </Link>
          </div>
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
                  {showArchived ? (
                    <Badge variant="outline">已归档</Badge>
                  ) : (
                    <Badge
                      variant={
                        project.approvedProfitCents >= 0 ? "secondary" : "destructive"
                      }
                    >
                      {project.approvedProfitCents >= 0 ? "盈利" : "亏损"}
                    </Badge>
                  )}
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
                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/projects/${project.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "flex-1"
                    )}
                  >
                    查看项目
                  </Link>
                  {showArchived ? (
                    <ProjectArchiveDialog
                      projectId={project.id}
                      archived={false}
                    />
                  ) : null}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            {showArchived
              ? "还没有已归档项目"
              : "还没有项目, 老板可以新建一个"}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
