"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createProject, type CreateProjectState } from "@/server/projects";

const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "项目名不能为空")
    .max(50, "项目名最多 50 个字"),
  description: z.string().trim().max(500, "描述最多 500 个字").optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const initialState: CreateProjectState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "创建中..." : "创建项目"}
    </Button>
  );
}

export default function NewProjectPage() {
  const [state, formAction, pending] = useActionState(
    createProject,
    initialState
  );
  const {
    register,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    mode: "onBlur",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">新建项目</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          创建后可以继续录入流水、设置分配方案。
        </p>
      </div>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>项目资料</CardTitle>
            <CardDescription>项目名会显示在账本和合伙人页面。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">项目名</Label>
              <Input
                id="name"
                placeholder="例如：image2"
                disabled={pending}
                aria-invalid={Boolean(errors.name || state.fieldErrors?.name)}
                {...register("name")}
              />
              {errors.name?.message ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
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
                placeholder="简要说明项目范围、用途或备注"
                disabled={pending}
                aria-invalid={Boolean(
                  errors.description || state.fieldErrors?.description
                )}
                {...register("description")}
              />
              {errors.description?.message ? (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              ) : null}
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
              href="/projects"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              取消
            </Link>
            <SubmitButton />
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
