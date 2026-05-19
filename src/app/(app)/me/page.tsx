import Link from "next/link";
import { redirect } from "next/navigation";

import {
  EarningsChart,
  type EarningsChartPoint,
} from "@/components/earnings-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/auth";
import { EntryStatus, EntryType } from "@/generated/prisma/enums";
import {
  signedDisplayAmountCents,
  signedProfitAmountCents,
} from "@/lib/amount";
import { prisma } from "@/lib/db";
import { entryTypeLabel, formatDate, formatYuan } from "@/lib/format";
import { cn } from "@/lib/utils";

type ApprovedEntry = {
  projectId: string;
  type: EntryType;
  amountCents: number;
  occurredAt: Date;
};

type AllocationPlan = {
  projectId: string;
  effectiveFrom: Date;
  createdAt: Date;
  shares: {
    userId: string;
    basisPoints: number;
  }[];
};

const statusBadgeClass = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-muted text-muted-foreground ring-border",
  VOIDED: "bg-muted text-muted-foreground line-through ring-border",
} satisfies Record<EntryStatus, string>;

const typeBadgeClass = {
  INCOME: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EXPENSE: "bg-red-50 text-red-700 ring-red-200",
  TRANSFER: "bg-blue-50 text-blue-700 ring-blue-200",
  PROXY_RECEIVE: "bg-purple-50 text-purple-700 ring-purple-200",
  PROXY_PAY: "bg-orange-50 text-orange-700 ring-orange-200",
} satisfies Record<EntryType, string>;

function formatBasisPoints(basisPoints: number) {
  return (basisPoints / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatChartDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusLabel(status: EntryStatus) {
  switch (status) {
    case EntryStatus.PENDING:
      return "待审核";
    case EntryStatus.APPROVED:
      return "已通过";
    case EntryStatus.REJECTED:
      return "已驳回";
    case EntryStatus.VOIDED:
      return "已冲销";
  }
}

function findEffectivePlan(
  plansByProject: Map<string, AllocationPlan[]>,
  projectId: string,
  occurredAt: Date
) {
  return plansByProject
    .get(projectId)
    ?.find((plan) => plan.effectiveFrom <= occurredAt);
}

function buildEarningsTimeline(params: {
  entries: ApprovedEntry[];
  plans: AllocationPlan[];
  projectNames: Map<string, string>;
  userId: string;
}): {
  chartData: EarningsChartPoint[];
  earningsByProjectCents: Map<string, number>;
} {
  const plansByProject = new Map<string, AllocationPlan[]>();

  for (const plan of params.plans) {
    const projectPlans = plansByProject.get(plan.projectId) ?? [];
    projectPlans.push(plan);
    plansByProject.set(plan.projectId, projectPlans);
  }

  for (const projectPlans of plansByProject.values()) {
    projectPlans.sort(
      (left, right) =>
        right.effectiveFrom.getTime() - left.effectiveFrom.getTime() ||
        right.createdAt.getTime() - left.createdAt.getTime()
    );
  }

  const runningEarnings = new Map<string, number>();
  const dailySnapshots = new Map<string, Map<string, number>>();

  for (const entry of params.entries) {
    const plan = findEffectivePlan(
      plansByProject,
      entry.projectId,
      entry.occurredAt
    );
    const userShare = plan?.shares.find((share) => share.userId === params.userId);

    if (!userShare) {
      continue;
    }

    const earningsDeltaCents = Math.round(
      (signedProfitAmountCents(entry) * userShare.basisPoints) / 10000
    );
    runningEarnings.set(
      entry.projectId,
      (runningEarnings.get(entry.projectId) ?? 0) + earningsDeltaCents
    );

    const dateKey = formatChartDate(entry.occurredAt);
    dailySnapshots.set(dateKey, new Map(runningEarnings));
  }

  const chartData = Array.from(dailySnapshots.entries()).map(
    ([date, earningsByProject]) => {
      const point: EarningsChartPoint = {
        date,
        总计: 0,
      };

      for (const [projectId, cents] of earningsByProject) {
        const projectName = params.projectNames.get(projectId);

        if (!projectName) {
          continue;
        }

        const yuan = cents / 100;
        point[projectName] = yuan;
        point["总计"] = Number(point["总计"]) + yuan;
      }

      return point;
    }
  );

  return {
    chartData,
    earningsByProjectCents: runningEarnings,
  };
}

export default async function MePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const now = new Date();

  const [projects, approvedEntries, myEntries] = await Promise.all([
    prisma.project.findMany({
      where: {
        active: true,
        allocations: {
          some: {
            shares: {
              some: {
                userId: session.user.id,
              },
            },
          },
        },
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
            createdAt: true,
            shares: {
              select: {
                userId: true,
                basisPoints: true,
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
        },
        entries: {
          where: {
            status: EntryStatus.APPROVED,
          },
          select: {
            type: true,
            amountCents: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.entry.findMany({
      where: {
        status: EntryStatus.APPROVED,
      },
      select: {
        projectId: true,
        type: true,
        amountCents: true,
        occurredAt: true,
      },
      orderBy: [
        {
          occurredAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    }),
    prisma.entry.findMany({
      where: {
        createdById: session.user.id,
      },
      select: {
        id: true,
        projectId: true,
        type: true,
        amountCents: true,
        description: true,
        occurredAt: true,
        status: true,
        rejectedReason: true,
        project: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        occurredAt: "desc",
      },
    }),
  ]);

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const allPlans = projects.flatMap((project) =>
    project.allocations.map((plan) => ({
      projectId: project.id,
      effectiveFrom: plan.effectiveFrom,
      createdAt: plan.createdAt,
      shares: plan.shares,
    }))
  );
  const { chartData, earningsByProjectCents } = buildEarningsTimeline({
    entries: approvedEntries,
    plans: allPlans,
    projectNames,
    userId: session.user.id,
  });

  const projectCards = projects.map((project) => {
    const currentPlan = project.allocations[0];
    const currentShare = currentPlan?.shares.find(
      (share) => share.userId === session.user.id
    );
    const netProfitCents = project.entries.reduce(
      (total, entry) => total + signedProfitAmountCents(entry),
      0
    );
    const earningsCents = earningsByProjectCents.get(project.id) ?? 0;

    return {
      id: project.id,
      name: project.name,
      basisPoints: currentShare?.basisPoints ?? 0,
      netProfitCents,
      earningsCents,
    };
  });

  const totalEarnedCents = projectCards.reduce(
    (total, project) => total + project.earningsCents,
    0
  );
  const totalReceivedCents = 0;
  const pendingSettlementCents = totalEarnedCents - totalReceivedCents;
  const rejectedEntryCount = myEntries.filter(
    (entry) => entry.status === EntryStatus.REJECTED
  ).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">我的回报</h1>
        <p className="text-sm text-muted-foreground">
          看自己参与项目的累计应得、待结算金额和增长曲线。
        </p>
      </div>

      {rejectedEntryCount > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          你有 {rejectedEntryCount} 笔流水被驳回，见下方历史流水，请按驳回原因修正后重新提交。
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>累计应得</CardTitle>
            <CardDescription>所有项目合计，截至现在</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-emerald-700">
              {formatYuan(totalEarnedCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>累计已收</CardTitle>
            <CardDescription>待功能</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {formatYuan(totalReceivedCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>待结算</CardTitle>
            <CardDescription>累计应得 - 累计已收</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-blue-700">
              {formatYuan(pendingSettlementCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">项目</h2>
            <p className="text-sm text-muted-foreground">
              当前份额按最新已生效分配方案展示。
            </p>
          </div>
        </div>

        {projectCards.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {projectCards.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <CardTitle className="text-xl">
                    <Link
                      href={`/projects/${project.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {project.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>我的份额</CardDescription>
                  <CardAction>
                    <Badge variant="secondary" className="tabular-nums">
                      {formatBasisPoints(project.basisPoints)}%
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        项目当前净利润
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-2xl font-semibold tabular-nums",
                          project.netProfitCents > 0 && "text-emerald-700",
                          project.netProfitCents < 0 && "text-red-700"
                        )}
                      >
                        {formatYuan(project.netProfitCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">我应得</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-blue-700">
                        {formatYuan(project.earningsCents)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>暂无参与项目</CardTitle>
              <CardDescription>
                老板把你加入项目分配方案后，这里会显示对应回报。
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>趋势曲线</CardTitle>
          <CardDescription>
            按已通过流水的发生时间累计，展示每个项目和总计的应得变化。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <EarningsChart data={chartData} />
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              等老板审核第一笔录入后这里会有曲线
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>历史流水</CardTitle>
          <CardDescription>我录入的流水，按发生时间倒序显示。</CardDescription>
        </CardHeader>
        <CardContent>
          {myEntries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myEntries.map((entry) => {
                  const amount = signedDisplayAmountCents(entry);
                  const detailHref = `/projects/${entry.projectId}/${entry.id}`;

                  return (
                    <TableRow key={entry.id} className="group cursor-pointer">
                      <TableCell className="text-muted-foreground">
                        <Link
                          href={detailHref}
                          className="block rounded-sm underline-offset-4 group-hover:underline"
                        >
                          {formatDate(entry.occurredAt)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={detailHref}
                          className="block rounded-sm underline-offset-4 group-hover:underline"
                        >
                          <span>{entry.project.name}</span>
                          <span className="mt-1 block max-w-72 truncate text-xs font-normal text-muted-foreground">
                            {entry.description}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={detailHref}
                          className="block rounded-sm underline-offset-4 group-hover:underline"
                        >
                          <Badge
                            variant="outline"
                            className={cn("ring-1", typeBadgeClass[entry.type])}
                          >
                            {entryTypeLabel(entry.type)}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          amount > 0 && "text-emerald-700",
                          amount < 0 && "text-red-700"
                        )}
                      >
                        <Link
                          href={detailHref}
                          className="block rounded-sm underline-offset-4 group-hover:underline"
                        >
                          {formatYuan(amount)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={detailHref}
                          className="block rounded-sm underline-offset-4 group-hover:underline"
                        >
                          <Badge
                            variant="outline"
                            className={cn("ring-1", statusBadgeClass[entry.status])}
                          >
                            {statusLabel(entry.status)}
                          </Badge>
                          {entry.status === EntryStatus.REJECTED ? (
                            <span className="mt-1 block max-w-80 whitespace-normal text-xs leading-5 text-red-700">
                              驳回原因：{entry.rejectedReason || "未填写"}
                            </span>
                          ) : null}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              你还没有录入过流水。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
