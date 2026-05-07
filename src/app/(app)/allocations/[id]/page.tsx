import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserRole } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";

type AllocationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatBasisPoints(basisPoints: number) {
  return (basisPoints / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function roleLabel(role: UserRole) {
  return role === UserRole.OWNER ? "老板" : "合伙人";
}

export default async function AllocationDetailPage({
  params,
}: AllocationDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.OWNER) {
    redirect("/projects");
  }

  const { id } = await params;
  const plan = await prisma.allocationPlan.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      effectiveFrom: true,
      note: true,
      createdAt: true,
      project: {
        select: {
          name: true,
        },
      },
      createdBy: {
        select: {
          name: true,
        },
      },
      shares: {
        select: {
          id: true,
          basisPoints: true,
          user: {
            select: {
              name: true,
              email: true,
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
  });

  if (!plan) {
    notFound();
  }

  const totalBasisPoints = plan.shares.reduce(
    (total, share) => total + share.basisPoints,
    0
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">分配方案</h1>
            <Badge variant="secondary">{plan.project.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            生效时间 {formatDate(plan.effectiveFrom)}
          </p>
        </div>
        <Link
          href="/allocations"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          返回分配方案
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>方案详情</CardTitle>
          <CardDescription>
            由 {plan.createdBy.name} 于 {formatDate(plan.createdAt)} 创建。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">项目</p>
            <p className="mt-1 font-medium">{plan.project.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">生效时间</p>
            <p className="mt-1 font-medium">{formatDate(plan.effectiveFrom)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">合计</p>
            <p className="mt-1 font-medium tabular-nums">
              {formatBasisPoints(totalBasisPoints)}%
            </p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-sm text-muted-foreground">备注</p>
            <p className="mt-1 text-sm">{plan.note || "无"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>历史 PartnerShare</CardTitle>
          <CardDescription>
            当前方案下每个用户的分配万分比和百分比。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead className="text-right">万分比</TableHead>
                <TableHead className="text-right">百分比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.shares.map((share) => (
                <TableRow key={share.id}>
                  <TableCell className="font-medium">
                    {share.user.name}
                  </TableCell>
                  <TableCell>{roleLabel(share.user.role)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {share.user.email}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {share.basisPoints}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBasisPoints(share.basisPoints)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

