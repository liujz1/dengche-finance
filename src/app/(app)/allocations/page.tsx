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
import { UserRole } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";

function formatBasisPoints(basisPoints: number) {
  return (basisPoints / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default async function AllocationsPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.OWNER) {
    redirect("/projects");
  }

  const now = new Date();
  const projects = await prisma.project.findMany({
    where: {
      active: true,
    },
    select: {
      id: true,
      name: true,
      allocations: {
        where: {
          effectiveFrom: {
            lte: now,
          },
        },
        select: {
          id: true,
          effectiveFrom: true,
          shares: {
            select: {
              basisPoints: true,
              user: {
                select: {
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              user: {
                createdAt: "asc",
              },
            },
          },
        },
        orderBy: [
          {
            effectiveFrom: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">分配方案</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看每个活跃项目当前生效的分配比例。
          </p>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const currentPlan = project.allocations[0];

            return (
              <Card
                key={project.id}
                className="transition-colors hover:bg-muted/20"
              >
                <CardHeader>
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                  <CardDescription>
                    {currentPlan
                      ? `当前方案生效于 ${formatDate(currentPlan.effectiveFrom)}`
                      : "还没有已生效的分配方案"}
                  </CardDescription>
                  <CardAction>
                    <Badge variant={currentPlan ? "secondary" : "outline"}>
                      {currentPlan ? "已配置" : "未配置"}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {currentPlan ? (
                    <div className="space-y-2">
                      {currentPlan.shares.map((share) => (
                        <div
                          key={`${project.id}-${share.user.name}`}
                          className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            {share.user.role === UserRole.OWNER
                              ? "老板"
                              : share.user.name}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatBasisPoints(share.basisPoints)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      录入新方案后，项目盈亏即可按比例分配。
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  {currentPlan ? (
                    <Link
                      href={`/allocations/${currentPlan.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "flex-1"
                      )}
                    >
                      查看方案
                    </Link>
                  ) : null}
                  <Link
                    href={`/allocations/new?projectId=${project.id}`}
                    className={cn(buttonVariants(), "flex-1")}
                  >
                    录入新方案
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>暂无活跃项目</CardTitle>
            <CardDescription>
              先新建项目，再为项目录入分配方案。
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

