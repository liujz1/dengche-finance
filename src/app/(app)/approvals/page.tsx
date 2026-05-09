import { redirect } from "next/navigation";

import { ApprovalDialog, type ApprovalEntry } from "@/app/(app)/approvals/approval-dialog";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
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
import { EntryStatus, type EntryType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { entryTypeLabel, formatDate, formatYuan } from "@/lib/format";
import { cn } from "@/lib/utils";

const typeBadgeClass: Record<EntryType, string> = {
  INCOME: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EXPENSE: "bg-red-50 text-red-700 ring-red-200",
  TRANSFER: "bg-blue-50 text-blue-700 ring-blue-200",
  PROXY_RECEIVE: "bg-purple-50 text-purple-700 ring-purple-200",
  PROXY_PAY: "bg-orange-50 text-orange-700 ring-orange-200",
};

function signedAmount(entry: { type: EntryType; amountCents: number }) {
  if (entry.type === "EXPENSE" || entry.type === "PROXY_PAY") {
    return -entry.amountCents;
  }

  return entry.amountCents;
}

function truncateText(value: string, maxLength = 28) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export default async function ApprovalsPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "OWNER") {
    redirect("/projects");
  }

  const entries = await prisma.entry.findMany({
    where: {
      status: EntryStatus.PENDING,
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      amountCents: true,
      description: true,
      occurredAt: true,
      status: true,
      createdAt: true,
      createdById: true,
      approvedById: true,
      approvedAt: true,
      rejectedReason: true,
      reversedFromId: true,
      project: {
        select: {
          name: true,
        },
      },
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
      evidences: {
        select: {
          id: true,
          r2Key: true,
          mimeType: true,
          sizeBytes: true,
        },
        orderBy: {
          uploadedAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const approvalEntries: ApprovalEntry[] = entries.map((entry) => ({
    id: entry.id,
    projectId: entry.projectId,
    projectName: entry.project.name,
    type: entry.type,
    amountCents: entry.amountCents,
    description: entry.description,
    occurredAt: entry.occurredAt,
    status: entry.status,
    createdAt: entry.createdAt,
    createdById: entry.createdById,
    createdByName: entry.createdBy.name,
    createdByEmail: entry.createdBy.email,
    approvedById: entry.approvedById,
    approvedAt: entry.approvedAt,
    rejectedReason: entry.rejectedReason,
    reversedFromId: entry.reversedFromId,
    evidences: entry.evidences,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">审核待办</h1>
            <Badge variant="secondary" className="tabular-nums">
              {approvalEntries.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            按提交时间从早到晚处理待审核流水。
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>待审核流水</CardTitle>
          <CardDescription>
            通过后计入项目盈亏；驳回必须填写原因。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvalEntries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>录入人</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalEntries.map((entry) => {
                  const amount = signedAmount(entry);

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.projectName}
                      </TableCell>
                      <TableCell>{entry.createdByName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("ring-1", typeBadgeClass[entry.type])}
                        >
                          {entryTypeLabel(entry.type)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          amount > 0 && "text-emerald-700",
                          amount < 0 && "text-red-700"
                        )}
                      >
                        {formatYuan(amount)}
                      </TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        {truncateText(entry.description)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ApprovalDialog entry={entry} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              审核待办空了
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
