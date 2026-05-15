"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { EntryStatus, EntryType } from "@/generated/prisma/enums";
import { signedDisplayAmountCents } from "@/lib/amount";
import { entryTypeLabel, formatDate, formatYuan } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  approveEntryAction,
  rejectEntryAction,
  type EntryApprovalState,
} from "@/server/entries";

type ApprovalEvidence = {
  id: string;
  r2Key: string;
  mimeType: string;
  sizeBytes: number;
};

export type ApprovalEntry = {
  id: string;
  projectId: string;
  projectName: string;
  type: EntryType;
  amountCents: number;
  description: string;
  occurredAt: Date;
  status: EntryStatus;
  createdAt: Date;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  reversedFromId: string | null;
  evidences: ApprovalEvidence[];
};

const initialState: EntryApprovalState = {};

const typeBadgeClass: Record<EntryType, string> = {
  INCOME: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EXPENSE: "bg-red-50 text-red-700 ring-red-200",
  TRANSFER: "bg-blue-50 text-blue-700 ring-blue-200",
  PROXY_RECEIVE: "bg-purple-50 text-purple-700 ring-purple-200",
  PROXY_PAY: "bg-orange-50 text-orange-700 ring-orange-200",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function evidenceUrl(r2Key: string) {
  return `/api/evidence/${encodeURIComponent(r2Key)}`;
}

function emptyValue(value: string | null) {
  return value || "无";
}

function ApprovalSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "处理中..." : "通过"}
    </Button>
  );
}

function RejectSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "处理中..." : "驳回"}
    </Button>
  );
}

function StateToaster({
  state,
  successMessage,
}: {
  state: EntryApprovalState;
  successMessage: string;
}) {
  const lastMessageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const message = state.error || (state.success ? successMessage : undefined);

    if (message && message !== lastMessageRef.current) {
      if (state.error) {
        toast.error(state.error);
      } else {
        toast.success(successMessage);
      }

      lastMessageRef.current = message;
    }
  }, [state, successMessage]);

  return null;
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

export function ApprovalDialog({ entry }: { entry: ApprovalEntry }) {
  const [approveState, approveAction] = useActionState(
    approveEntryAction,
    initialState
  );
  const [rejectState, rejectAction] = useActionState(
    rejectEntryAction,
    initialState
  );
  const amount = signedDisplayAmountCents(entry);

  return (
    <>
      <StateToaster state={approveState} successMessage="已通过" />
      <StateToaster state={rejectState} successMessage="已驳回" />
      <Dialog>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          查看
        </DialogTrigger>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-8">审核流水</DialogTitle>
            <DialogDescription>
              {entry.projectName} · {entry.createdByName} ·{" "}
              {formatDate(entry.createdAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <dl className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3">
              <DetailItem label="流水 ID" value={entry.id} />
              <DetailItem label="项目 ID" value={entry.projectId} />
              <DetailItem label="项目" value={entry.projectName} />
              <DetailItem label="状态" value="待审核" />
              <DetailItem
                label="类型"
                value={
                  <Badge
                    variant="outline"
                    className={cn("ring-1", typeBadgeClass[entry.type])}
                  >
                    {entryTypeLabel(entry.type)}
                  </Badge>
                }
              />
              <DetailItem
                label="金额"
                value={
                  <span
                    className={cn(
                      "tabular-nums",
                      amount > 0 && "text-emerald-700",
                      amount < 0 && "text-red-700"
                    )}
                  >
                    {formatYuan(amount)}
                  </span>
                }
              />
              <DetailItem label="发生时间" value={formatDate(entry.occurredAt)} />
              <DetailItem label="录入时间" value={formatDate(entry.createdAt)} />
              <DetailItem label="录入人 ID" value={entry.createdById} />
              <DetailItem
                label="录入人"
                value={`${entry.createdByName} (${entry.createdByEmail})`}
              />
              <DetailItem label="审核人 ID" value={emptyValue(entry.approvedById)} />
              <DetailItem
                label="审核时间"
                value={entry.approvedAt ? formatDate(entry.approvedAt) : "无"}
              />
              <DetailItem
                label="冲销来源 ID"
                value={emptyValue(entry.reversedFromId)}
              />
              <DetailItem
                label="驳回原因"
                value={emptyValue(entry.rejectedReason)}
                className="sm:col-span-3"
              />
              <DetailItem
                label="描述"
                value={entry.description}
                className="sm:col-span-3"
              />
            </dl>

            <section className="space-y-3">
              <h2 className="text-sm font-medium">凭证图片</h2>
              {entry.evidences.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {entry.evidences.map((evidence) => {
                    const url = evidenceUrl(evidence.r2Key);

                    return (
                      <figure
                        key={evidence.id}
                        className="overflow-hidden rounded-lg border bg-background"
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="在新标签打开凭证原图"
                          title="打开原图"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="凭证图片"
                            className="max-h-[480px] w-full cursor-pointer bg-muted object-contain"
                          />
                        </a>
                        <figcaption className="space-y-1 border-t p-3 text-xs text-muted-foreground">
                          <p className="break-all text-foreground">
                            {evidence.r2Key}
                          </p>
                          <p>
                            {evidence.mimeType} ·{" "}
                            {formatFileSize(evidence.sizeBytes)}
                          </p>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  这条流水没有凭证图片。
                </div>
              )}
            </section>
          </div>
          <DialogFooter className="grid gap-3 bg-background sm:justify-normal lg:grid-cols-[1fr_2fr]">
            <form action={approveAction} className="flex items-end">
              <input type="hidden" name="entryId" value={entry.id} />
              <ApprovalSubmitButton />
            </form>

            <form
              action={rejectAction}
              className="grid gap-2 sm:grid-cols-[1fr_auto]"
            >
              <input type="hidden" name="entryId" value={entry.id} />
              <Textarea
                name="reason"
                minLength={1}
                maxLength={200}
                required
                placeholder="原因"
                aria-label="驳回原因"
                className="min-h-20"
              />
              <div className="flex items-end">
                <RejectSubmitButton />
              </div>
              {rejectState.error ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {rejectState.error}
                </p>
              ) : null}
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
