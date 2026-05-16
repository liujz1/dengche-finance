"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
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
import {
  setProjectArchivedAction,
  type ProjectArchiveState,
} from "@/server/projects";

const initialState: ProjectArchiveState = {};

function SubmitButton({ archived }: { archived: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={archived ? "destructive" : "default"} disabled={pending}>
      {pending ? "处理中..." : archived ? "确认归档" : "确认恢复"}
    </Button>
  );
}

export function ProjectArchiveDialog({
  projectId,
  archived,
}: {
  projectId: string;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    setProjectArchivedAction,
    initialState
  );
  const lastMessageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const message =
      state.error || (state.success ? (archived ? "项目已归档" : "项目已恢复") : undefined);

    if (!message || message === lastMessageRef.current) {
      return;
    }

    if (state.error) {
      toast.error(state.error);
    } else {
      toast.success(message);
      setOpen(false);
    }

    lastMessageRef.current = message;
  }, [archived, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={archived ? "destructive" : "outline"} />
        }
      >
        {archived ? "归档项目" : "恢复项目"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{archived ? "归档项目" : "恢复项目"}</DialogTitle>
          <DialogDescription>
            {archived
              ? "归档后项目从列表和录入选项消失、数据保留、可恢复。"
              : "恢复后项目会重新出现在列表和录入选项中。"}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={projectId} />
          <input type="hidden" name="archived" value={String(archived)} />
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
            <DialogClose render={<Button type="button" variant="outline" />}>
              取消
            </DialogClose>
            <SubmitButton archived={archived} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
