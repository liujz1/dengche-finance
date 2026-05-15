import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EntryRow } from "@/components/entry-row";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntryStatus } from "@/generated/prisma/enums";
import {
  isProfitEntryType,
  isProfitExpenseEntryType,
  isProfitIncomeEntryType,
  signedProfitAmountCents,
} from "@/lib/amount";
import { prisma } from "@/lib/db";
import { formatYuan } from "@/lib/format";
import { cn } from "@/lib/utils";

type ProjectDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function statToneClass(cents: number) {
  if (cents > 0) {
    return "text-emerald-700";
  }

  if (cents < 0) {
    return "text-red-700";
  }

  return "text-foreground";
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const isOwner = session.user.role === "OWNER";

  const project = await prisma.project.findFirst({
    where: {
      id,
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
    },
  });

  if (!project) {
    notFound();
  }

  const [approvedProfitEntries, pendingCount, entries] =
    await Promise.all([
      prisma.entry.findMany({
        where: {
          projectId: project.id,
          status: EntryStatus.APPROVED,
        },
        select: {
          type: true,
          amountCents: true,
        },
      }),
      prisma.entry.count({
        where: {
          projectId: project.id,
          status: EntryStatus.PENDING,
        },
      }),
      prisma.entry.findMany({
        where: {
          projectId: project.id,
          status: {
            in: [EntryStatus.APPROVED, EntryStatus.PENDING],
          },
        },
        include: {
          evidences: true,
          createdBy: true,
        },
        orderBy: {
          occurredAt: "desc",
        },
      }),
    ]);

  const incomeSummary = approvedProfitEntries.reduce(
    (summary, entry) => {
      if (isProfitIncomeEntryType(entry.type)) {
        summary.amountCents += entry.amountCents;
        summary.count += 1;
      }

      return summary;
    },
    { amountCents: 0, count: 0 }
  );
  const expenseSummary = approvedProfitEntries.reduce(
    (summary, entry) => {
      if (isProfitExpenseEntryType(entry.type)) {
        summary.amountCents += entry.amountCents;
        summary.count += 1;
      }

      return summary;
    },
    { amountCents: 0, count: 0 }
  );
  const incomeCents = incomeSummary.amountCents;
  const expenseCents = expenseSummary.amountCents;
  const profitCents = approvedProfitEntries.reduce(
    (total, entry) => total + signedProfitAmountCents(entry),
    0
  );
  const profitEntryCount = approvedProfitEntries.filter((entry) =>
    isProfitEntryType(entry.type)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">
              {project.name}
            </h1>
            <Badge variant="secondary">项目详情</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {project.description || "暂无描述"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Link
              href={`/allocations?projectId=${project.id}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              管理分配方案
            </Link>
          ) : null}
          <Link
            href={`/entries/new?projectId=${project.id}`}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            + 录入新流水
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>总收入</CardTitle>
            <CardDescription>{incomeSummary.count} 笔已通过收入</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-emerald-700">
              {formatYuan(incomeCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>总支出</CardTitle>
            <CardDescription>{expenseSummary.count} 笔已通过支出</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-red-700">
              {formatYuan(expenseCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>净利润</CardTitle>
            <CardDescription>
              {profitEntryCount} 笔已通过盈亏流水
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-3xl font-semibold tabular-nums",
                statToneClass(profitCents)
              )}
            >
              {formatYuan(profitCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {pendingCount > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-amber-900">待审核流水</CardTitle>
            <CardDescription className="text-amber-800">
              当前有 {pendingCount} 笔待老板审核，暂不计入项目盈亏。
            </CardDescription>
            {isOwner ? (
              <CardAction>
                <Link
                  href="/approvals"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  去审核
                </Link>
              </CardAction>
            ) : null}
          </CardHeader>
        </Card>
      ) : null}

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>流水列表</CardTitle>
              <CardDescription>
                仅显示已通过和待审核流水；驳回、冲销记录可查看全部。
              </CardDescription>
            </div>
            <Link
              href={`/projects/${project.id}/all`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              查看全部
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>录入人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>凭证</TableHead>
                  {isOwner ? <TableHead>操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} isOwner={isOwner} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              还没有已通过或待审核流水。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
