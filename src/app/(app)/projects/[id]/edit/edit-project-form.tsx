"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  updateProjectAction,
  type UpdateProjectState,
} from "@/server/projects";

type EditProjectFormProps = {
  project: {
    id: string;
    name: string;
    description: string | null;
  };
};

const initialState: UpdateProjectState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "保存中..." : "保存"}
    </Button>
  );
}

export function EditProjectForm({ project }: EditProjectFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProjectAction,
    initialState
  );
  const router = useRouter();
  const lastErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.error && state.error !== lastErrorRef.current) {
      toast.error(state.error);
      lastErrorRef.current = state.error;
    }
  }, [state.error]);

  useEffect(() => {
    if (state.success && state.projectId) {
      toast.success("已保存");
      router.push(`/projects/${state.projectId}`);
    }
  }, [state.success, state.projectId, router]);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>项目资料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="hidden" name="id" value={project.id} />

          <div className="space-y-2">
            <Label htmlFor="name">项目名</Label>
            <Input
              id="name"
              name="name"
              defaultValue={project.name}
              minLength={1}
              maxLength={50}
              required
              disabled={pending}
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            {state.fieldErrors?.name?.length ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.name[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={project.description ?? ""}
              maxLength={500}
              disabled={pending}
              aria-invalid={Boolean(state.fieldErrors?.description)}
            />
            {state.fieldErrors?.description?.length ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.description[0]}
              </p>
            ) : null}
          </div>

          {state.error ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link
            href={`/projects/${project.id}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            取消
          </Link>
          <SubmitButton />
        </CardFooter>
      </Card>
    </form>
  );
}
