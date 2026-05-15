"use client";

import { type ReactNode, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageIcon, PaperclipIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { EntryStatus, EntryType } from "@/generated/prisma/enums";
import { signedDisplayAmountCents } from "@/lib/amount";
import { getEvidencePublicUrl } from "@/lib/evidence-url";
import { entryTypeLabel, formatDate, formatYuan } from "@/lib/format";
import { cn } from "@/lib/utils";
import { reverseEntryAction, type ReverseEntryState } from "@/server/entries";

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
  reversedFromId: string | null;
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

function evidenceUrl(r2Key: string) {
  if (r2Key.startsWith("http://") || r2Key.startsWith("https://")) {
    return r2Key;
  }

  return getEvidencePublicUrl(r2Key);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const initialReverseState: ReverseEntryState = {};

function ReverseSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "处理中..." : "确认冲销"}
    </Button>
  );
}

function StateToaster({
  state,
  successMessage,
  onSuccess,
}: {
  state: ReverseEntryState;
  successMessage: string;
  onSuccess?: () => void;
}) {
  const lastMessageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const message = state.error || (state.success ? successMessage : undefined);

    if (message && message !== lastMessageRef.current) {
      if (state.error) {
        toast.error(state.error);
      } else {
        toast.success(successMessage);
        onSuccess?.();
      }

      lastMessageRef.current = message;
    }
  }, [onSuccess, state, successMessage]);

  return null;
}

function EntryDetailTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogTrigger
      render={
        <button
          type="button"
          className={cn(
            "block w-full cursor-pointer appearance-none bg-transparent p-0 text-left text-inherit focus-visible:outline-none",
            className
          )}
        />
      }
    >
      {children}
    </DialogTrigger>
  );
}

function ReverseEntryDialog({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    reverseEntryAction,
    initialReverseState
  );

  return (
    <>
      <StateToaster
        state={state}
        successMessage="已冲销"
        onSuccess={() => setOpen(false)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant="destructive"
              size="sm"
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          反向冲销
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>反向冲销</DialogTitle>
            <DialogDescription>
              请填写冲销原因。提交后原流水会标记为已冲销。
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="entryId" value={entryId} />
            <Textarea
              name="reason"
              minLength={1}
              maxLength={200}
              required
              placeholder="原因"
              aria-label="冲销原因"
              className="min-h-24"
            />
            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
              <DialogClose render={<Button type="button" variant="outline" />}>
                取消
              </DialogClose>
              <ReverseSubmitButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EntryRow({
  entry,
  isOwner,
}: {
  entry: EntryRowEntry;
  isOwner?: boolean;
}) {
  const displayAmount = signedDisplayAmountCents(entry);
  const canReverse = entry.status === "APPROVED" && isOwner && !entry.reversedFromId;

  return (
    <Dialog>
      <TableRow className="cursor-pointer">
        <TableCell className="text-muted-foreground">
          <EntryDetailTrigger>{formatDate(entry.occurredAt)}</EntryDetailTrigger>
        </TableCell>
        <TableCell>
          <EntryDetailTrigger>
            <Badge
              variant="outline"
              className={cn("ring-1", typeBadgeClass[entry.type])}
            >
              {entryTypeLabel(entry.type)}
            </Badge>
          </EntryDetailTrigger>
        </TableCell>
        <TableCell
          className={cn(
            "text-right font-medium tabular-nums",
            displayAmount > 0 && "text-emerald-700",
            displayAmount < 0 && "text-red-700"
          )}
        >
          <EntryDetailTrigger className="text-right font-medium tabular-nums">
            {formatYuan(displayAmount)}
          </EntryDetailTrigger>
        </TableCell>
        <TableCell className="max-w-[320px] whitespace-normal">
          <EntryDetailTrigger className="whitespace-normal">
            {entry.description}
          </EntryDetailTrigger>
        </TableCell>
        <TableCell>
          <EntryDetailTrigger>{entry.createdBy.name}</EntryDetailTrigger>
        </TableCell>
        <TableCell>
          <EntryDetailTrigger>
            <Badge
              variant="outline"
              className={cn("ring-1", statusBadgeClass[entry.status])}
            >
              {statusLabel(entry.status)}
            </Badge>
          </EntryDetailTrigger>
        </TableCell>
        <TableCell>
          <EntryDetailTrigger>
            <span className="flex items-center gap-1 text-muted-foreground">
              {entry.evidences.length > 0 ? (
                <>
                  <PaperclipIcon className="size-4" />
                  <span className="tabular-nums">{entry.evidences.length}</span>
                </>
              ) : (
                <span>无</span>
              )}
            </span>
          </EntryDetailTrigger>
        </TableCell>
        {isOwner ? (
          <TableCell>
            {canReverse ? <ReverseEntryDialog entryId={entry.id} /> : null}
          </TableCell>
        ) : null}
      </TableRow>
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
