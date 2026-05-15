"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EntryType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import {
  createEntryAction,
  type CreateEntryState,
} from "@/server/entries";

type ProjectOption = {
  id: string;
  name: string;
};

type NewEntryFormProps = {
  projects: ProjectOption[];
  defaultProjectId?: string;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ENTRY_AMOUNT_CENTS = 2_000_000_000;
const MAX_ENTRY_AMOUNT_YUAN = MAX_ENTRY_AMOUNT_CENTS / 100;
const MAX_ENTRY_AMOUNT_MESSAGE = "单笔金额不能超过 2000 万元";
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const entryTypeOptions = [
  { value: EntryType.INCOME, label: "收入" },
  { value: EntryType.EXPENSE, label: "支出" },
  { value: EntryType.TRANSFER, label: "转账" },
  { value: EntryType.PROXY_RECEIVE, label: "代收" },
  { value: EntryType.PROXY_PAY, label: "代付" },
] as const;

const entryFormSchema = z.object({
  projectId: z.string().min(1, "请选择项目"),
  type: z.enum(EntryType, "请选择流水类型"),
  amountYuan: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "金额最多保留 2 位小数")
    .refine((value) => Number(value) > 0, "金额必须大于 0")
    .transform((value) => Math.round(Number(value) * 100))
    .refine(
      (cents) =>
        Number.isSafeInteger(cents) &&
        cents >= 1 &&
        cents <= MAX_ENTRY_AMOUNT_CENTS,
      MAX_ENTRY_AMOUNT_MESSAGE
    )
    .transform((cents) => (cents / 100).toFixed(2)),
  description: z
    .string()
    .trim()
    .min(1, "描述不能为空")
    .max(200, "描述最多 200 个字"),
  occurredAt: z.string().min(1, "请选择发生时间"),
  evidence: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, "请上传一张凭证图片")
    .refine((files) => {
      const file = files?.item(0);
      return file ? ALLOWED_MIME_TYPES.has(file.type) : false;
    }, "凭证必须是 jpeg、png、webp 或 heic 图片")
    .refine((files) => {
      const file = files?.item(0);
      return file ? file.size <= MAX_FILE_SIZE_BYTES : false;
    }, "凭证图片不能超过 5MB"),
});

type EntryFormValues = z.infer<typeof entryFormSchema>;

const initialState: CreateEntryState = {};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function validateEvidenceFile(formData: FormData) {
  const evidence = formData.get("evidence");

  if (!(evidence instanceof File) || evidence.size === 0) {
    return "请上传一张凭证图片";
  }

  if (!ALLOWED_MIME_TYPES.has(evidence.type)) {
    return "凭证必须是 jpeg、png、webp 或 heic 图片";
  }

  if (evidence.size > MAX_FILE_SIZE_BYTES) {
    return "凭证图片不能超过 5MB";
  }

  return null;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "提交中..." : "提交审核"}
    </Button>
  );
}

export function NewEntryForm({
  projects,
  defaultProjectId,
}: NewEntryFormProps) {
  const [state, formAction, pending] = useActionState(
    createEntryAction,
    initialState
  );
  const [, startTransition] = useTransition();
  const router = useRouter();
  const lastErrorRef = useRef<string | undefined>(undefined);
  const safeDefaultProjectId = projects.some(
    (project) => project.id === defaultProjectId
  )
    ? defaultProjectId
    : projects[0]?.id;
  const {
    register,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    mode: "onBlur",
    defaultValues: {
      projectId: safeDefaultProjectId || "",
      type: EntryType.EXPENSE,
      amountYuan: "",
      description: "",
      occurredAt: todayString(),
    },
  });
  const selectedProjectId = watch("projectId");
  const selectedType = watch("type");

  useEffect(() => {
    if (state.error && state.error !== lastErrorRef.current) {
      toast.error(state.error);
      lastErrorRef.current = state.error;
    }
  }, [state.error]);

  useEffect(() => {
    if (state.success && state.projectId) {
      toast.success("已提交，等待老板审核");
      router.push(`/projects/${state.projectId}`);
    }
  }, [state.success, state.projectId, router]);

  return (
    <form
      action={async (formData) => {
        const evidenceError = validateEvidenceFile(formData);

        if (evidenceError) {
          toast.error(evidenceError);
          await trigger("evidence");
          return;
        }

        const isValid = await trigger();

        if (!isValid) {
          toast.error("请检查表单内容");
          return;
        }

        startTransition(() => {
          formAction(formData);
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>录入新流水</CardTitle>
          <CardDescription>
            提交后进入待审核，老板通过前不会计入项目盈亏。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="projectId">项目</Label>
            <Select
              name="projectId"
              value={selectedProjectId}
              onValueChange={(value) => {
                setValue("projectId", value ?? "", {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              disabled={pending || projects.length === 0}
              required
            >
              <SelectTrigger
                id="projectId"
                className="h-10 w-full"
                aria-invalid={Boolean(errors.projectId)}
              >
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.projectId?.message ? (
              <p className="text-sm text-destructive">
                {errors.projectId.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">类型</Label>
            <Select
              name="type"
              value={selectedType}
              onValueChange={(value) => {
                setValue("type", value as EntryFormValues["type"], {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              disabled={pending}
              required
            >
              <SelectTrigger
                id="type"
                className="h-10 w-full"
                aria-invalid={Boolean(errors.type)}
              >
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                {entryTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type?.message ? (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountYuan">金额</Label>
            <Input
              id="amountYuan"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={MAX_ENTRY_AMOUNT_YUAN}
              placeholder="0.00"
              disabled={pending}
              aria-invalid={Boolean(errors.amountYuan)}
              {...register("amountYuan")}
            />
            <p className="text-xs text-muted-foreground">单位：元</p>
            {errors.amountYuan?.message ? (
              <p className="text-sm text-destructive">
                {errors.amountYuan.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurredAt">发生时间</Label>
            <Input
              id="occurredAt"
              type="date"
              disabled={pending}
              aria-invalid={Boolean(errors.occurredAt)}
              {...register("occurredAt")}
            />
            {errors.occurredAt?.message ? (
              <p className="text-sm text-destructive">
                {errors.occurredAt.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">凭证</Label>
            <Input
              id="evidence"
              type="file"
              accept="image/*"
              disabled={pending}
              aria-invalid={Boolean(errors.evidence)}
              {...register("evidence")}
            />
            <p className="text-xs text-muted-foreground">
              必须上传一张图片，最大 5MB。
            </p>
            {errors.evidence?.message ? (
              <p className="text-sm text-destructive">
                {errors.evidence.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              placeholder="一句话说明这笔流水"
              maxLength={200}
              disabled={pending}
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            {errors.description?.message ? (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          {state.error ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2"
              role="alert"
            >
              {state.error}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link
            href={
              selectedProjectId ? `/projects/${selectedProjectId}` : "/projects"
            }
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
