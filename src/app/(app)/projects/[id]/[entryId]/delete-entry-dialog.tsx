"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { deleteEntryAction, type DeleteEntryState } from "@/server/entries";

const initialState: DeleteEntryState = {};

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "删除中..." : "确认删除"}
    </Button>
  );
}

export function DeleteEntryDialog({
  entryId,
  projectId,
}: {
  entryId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const [state, formAction] = useActionState(deleteEntryAction, initialState);
  const lastMessageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const message = state.error || (state.success ? "流水已删除" : undefined);

    if (!message || message === lastMessageRef.current) {
      return;
    }

    if (state.error) {
      toast.error(state.error);
    } else {
      toast.success(message);
      setOpen(false);
      startTransition(() => {
        router.push(`/projects/${state.projectId || projectId}`);
      });
    }

    lastMessageRef.current = message;
  }, [projectId, router, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" disabled={isNavigating} />}>
        <Trash2Icon />
        删除流水
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除流水</DialogTitle>
          <DialogDescription>
            删除后该流水及其凭证将被移除、盈亏与趋势曲线重新计算, 此操作不可恢复(操作会记入日志)。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="entryId" value={entryId} />
          <Textarea
            name="reason"
            minLength={1}
            maxLength={200}
            required
            placeholder="删除原因"
            aria-label="删除原因"
            className="min-h-28"
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
            <DeleteSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
