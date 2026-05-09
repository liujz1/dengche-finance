import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatDate, formatYuan } from "@/lib/format";

const eventTypeLabel: Record<string, string> = {
  ENTRY_CREATED: "创建",
  ENTRY_APPROVED: "通过",
  ENTRY_REJECTED: "驳回",
  ENTRY_REVERSED: "反向冲销",
  ALLOCATION_PLAN_CREATED: "录入分配方案",
};

const eventBadgeClass: Record<string, string> = {
  ENTRY_CREATED: "bg-blue-50 text-blue-700 ring-blue-200",
  ENTRY_APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ENTRY_REJECTED: "bg-red-50 text-red-700 ring-red-200",
  ENTRY_REVERSED: "bg-orange-50 text-orange-700 ring-orange-200",
};

export default async function EntryAuditPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id: projectId, entryId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const entry = await prisma.entry.findFirst({
    where: { id: entryId, projectId },
    select: {
      id: true,
      description: true,
      amountCents: true,
      status: true,
      occurredAt: true,
      createdAt: true,
      project: { select: { name: true } },
    },
  });

  if (!entry) {
    notFound();
  }

  const events = await prisma.ledgerEvent.findMany({
    where: { entryId },
    select: {
      id: true,
      eventType: true,
      occurredAt: true,
      payloadJson: true,
      actor: { select: { name: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">流水审计时间线</h1>
        <p className="text-sm text-muted-foreground">
          {entry.project.name} · {entry.description} ·{" "}
          {formatYuan(entry.amountCents)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>事件时间线</CardTitle>
          <CardDescription>共 {events.length} 条事件，按时间从早到晚。</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <ol className="relative space-y-6 border-l border-border pl-6">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Badge
                      variant="secondary"
                      className={eventBadgeClass[event.eventType] ?? ""}
                    >
                      {eventTypeLabel[event.eventType] ?? event.eventType}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(event.occurredAt)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      由 {event.actor.name}
                    </span>
                  </div>
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(event.payloadJson), null, 2);
                      } catch {
                        return event.payloadJson;
                      }
                    })()}
                  </pre>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">这条流水没有事件记录。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
