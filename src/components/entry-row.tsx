"use client";

import { ImageIcon, PaperclipIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import type { EntryStatus, EntryType } from "@/generated/prisma/enums";
import { entryTypeLabel, formatDate, formatYuan } from "@/lib/format";
import { cn } from "@/lib/utils";

type EntryRowEvidence = {
  id: string;
  r2Key: string;
  mimeType: string;
  sizeBytes: number;
};

export type EntryRowEntry = {
  id: string;
  type: EntryType;
  amountCents: number;
  description: string;
  occurredAt: Date;
  status: EntryStatus;
  createdBy: {
    name: string;
  };
  evidences: EntryRowEvidence[];
};

const typeBadgeClass: Record<EntryType, string> = {
  INCOME: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EXPENSE: "bg-red-50 text-red-700 ring-red-200",
  TRANSFER: "bg-blue-50 text-blue-700 ring-blue-200",
  PROXY_RECEIVE: "bg-purple-50 text-purple-700 ring-purple-200",
  PROXY_PAY: "bg-orange-50 text-orange-700 ring-orange-200",
};

const statusBadgeClass: Record<EntryStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-muted text-muted-foreground ring-border",
  VOIDED: "bg-muted text-muted-foreground line-through ring-border",
};

function statusLabel(status: EntryStatus) {
  switch (status) {
    case "PENDING":
      return "待审核";
    case "APPROVED":
      return "已通过";
    case "REJECTED":
      return "已驳回";
    case "VOIDED":
      return "已冲销";
  }
}

function signedAmount(entry: EntryRowEntry) {
  if (entry.type === "EXPENSE" || entry.type === "PROXY_PAY") {
    return -entry.amountCents;
  }

  return entry.amountCents;
}

function evidenceUrl(r2Key: string) {
  if (r2Key.startsWith("http://") || r2Key.startsWith("https://")) {
    return r2Key;
  }

  return null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function EntryRow({ entry }: { entry: EntryRowEntry }) {
  const displayAmount = signedAmount(entry);

  return (
    <Dialog>
      <DialogTrigger render={<TableRow className="cursor-pointer" />}>
        <TableCell className="text-muted-foreground">
          {formatDate(entry.occurredAt)}
        </TableCell>
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
            displayAmount > 0 && "text-emerald-700",
            displayAmount < 0 && "text-red-700"
          )}
        >
          {formatYuan(displayAmount)}
        </TableCell>
        <TableCell className="max-w-[320px] whitespace-normal">
          {entry.description}
        </TableCell>
        <TableCell>{entry.createdBy.name}</TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn("ring-1", statusBadgeClass[entry.status])}
          >
            {statusLabel(entry.status)}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-muted-foreground">
            {entry.evidences.length > 0 ? (
              <>
                <PaperclipIcon className="size-4" />
                <span className="tabular-nums">{entry.evidences.length}</span>
              </>
            ) : (
              <span>无</span>
            )}
          </div>
        </TableCell>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{entry.description}</DialogTitle>
          <DialogDescription>
            {formatDate(entry.occurredAt)} · {entry.createdBy.name} ·{" "}
            {entryTypeLabel(entry.type)} · {formatYuan(displayAmount)}
          </DialogDescription>
        </DialogHeader>

        {entry.evidences.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.evidences.map((evidence) => {
              const url = evidenceUrl(evidence.r2Key);
              const isImage = evidence.mimeType.startsWith("image/");

              return (
                <div
                  key={evidence.id}
                  className="overflow-hidden rounded-lg border bg-muted/20"
                >
                  {url && isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt="流水凭证"
                      className="max-h-[420px] w-full object-contain"
                    />
                  ) : (
                    <div className="flex min-h-40 items-center justify-center bg-muted text-muted-foreground">
                      <ImageIcon className="size-8" />
                    </div>
                  )}
                  <div className="space-y-1 border-t p-3 text-xs text-muted-foreground">
                    <p className="break-all text-foreground">{evidence.r2Key}</p>
                    <p>
                      {evidence.mimeType} · {formatFileSize(evidence.sizeBytes)}
                    </p>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-4"
                      >
                        打开原图
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            这条流水没有凭证记录。
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
