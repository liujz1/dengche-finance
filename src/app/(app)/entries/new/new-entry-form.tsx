"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type DragEvent,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
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
const MAX_EVIDENCE_FILES = 9;
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
});

type EntryFormValues = z.infer<typeof entryFormSchema>;

const initialState: CreateEntryState = {};

type EvidencePreview = {
  id: string;
  file: File;
  url: string;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createEvidencePreview(file: File): EvidencePreview {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    url: URL.createObjectURL(file),
  };
}

function validateEvidenceFiles(files: File[]) {
  if (files.length < 1 || files.length > MAX_EVIDENCE_FILES) {
    return "请上传 1~9 张凭证图片";
  }

  if (files.some((file) => !ALLOWED_MIME_TYPES.has(file.type))) {
    return "凭证必须是 jpeg、png、webp 或 heic 图片";
  }

  if (files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
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
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);
  const evidencePreviewsRef = useRef<EvidencePreview[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<EvidencePreview[]>(
    []
  );
  const [isDraggingEvidence, setIsDraggingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
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
    return () => {
      evidencePreviewsRef.current.forEach((preview) =>
        URL.revokeObjectURL(preview.url)
      );
    };
  }, []);

  function replaceEvidencePreviews(nextPreviews: EvidencePreview[]) {
    setEvidencePreviews((currentPreviews) => {
      currentPreviews
        .filter(
          (preview) =>
            !nextPreviews.some((nextPreview) => nextPreview.id === preview.id)
        )
        .forEach((preview) => URL.revokeObjectURL(preview.url));

      evidencePreviewsRef.current = nextPreviews;
      return nextPreviews;
    });
  }

  function addEvidenceFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.size > 0);

    if (files.length === 0) {
      return;
    }

    const nextFiles = [
      ...evidencePreviews.map((preview) => preview.file),
      ...files,
    ];
    const error = validateEvidenceFiles(nextFiles);

    if (error) {
      setEvidenceError(error);
      toast.error(error);
      return;
    }

    setEvidenceError(null);
    replaceEvidencePreviews([
      ...evidencePreviews,
      ...files.map(createEvidencePreview),
    ]);
  }

  function removeEvidencePreview(id: string) {
    replaceEvidencePreviews(
      evidencePreviews.filter((preview) => preview.id !== id)
    );
  }

  function handleEvidenceChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addEvidenceFiles(event.target.files);
    }
    // 清空原生 input —— 提交以 evidencePreviews 状态为准；
    // 清空后同一文件可再次选择（change 事件能再次触发）。
    event.target.value = "";
  }

  function handleEvidenceDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!pending) {
      event.dataTransfer.dropEffect = "copy";
      setIsDraggingEvidence(true);
    }
  }

  function handleEvidenceDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingEvidence(false);
    }
  }

  function handleEvidenceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingEvidence(false);

    if (pending) {
      return;
    }

    addEvidenceFiles(event.dataTransfer.files);
  }

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
        // 提交真相源 = evidencePreviews 状态（原生 input.files 在拖拽场景不可靠）
        const evidenceFiles = evidencePreviews.map((preview) => preview.file);
        const evidenceErr = validateEvidenceFiles(evidenceFiles);

        if (evidenceErr) {
          setEvidenceError(evidenceErr);
          toast.error(evidenceErr);
          return;
        }

        setEvidenceError(null);
        formData.delete("evidence");
        evidenceFiles.forEach((file) => formData.append("evidence", file));

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
            <div
              className={cn(
                "rounded-lg border border-dashed p-3 transition-colors",
                isDraggingEvidence
                  ? "border-primary bg-primary/5"
                  : "border-input bg-transparent",
                pending ? "pointer-events-none opacity-50" : null,
                evidenceError ? "border-destructive" : null
              )}
              onDragOver={handleEvidenceDragOver}
              onDragEnter={handleEvidenceDragOver}
              onDragLeave={handleEvidenceDragLeave}
              onDrop={handleEvidenceDrop}
            >
              <Input
                id="evidence"
                type="file"
                accept="image/*"
                multiple
                disabled={pending}
                aria-invalid={Boolean(evidenceError)}
                onChange={handleEvidenceChange}
                ref={evidenceInputRef}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                点击选择或拖拽上传，需 1~9 张图片，每张最大 5MB。
              </p>
              {evidencePreviews.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {evidencePreviews.map((preview, index) => (
                    <div
                      key={preview.id}
                      className="overflow-hidden rounded-lg border bg-muted/20"
                    >
                      <img
                        src={preview.url}
                        alt={`凭证预览 ${index + 1}`}
                        className="aspect-square w-full object-cover"
                      />
                      <div className="space-y-1 p-2">
                        <p className="truncate text-xs text-foreground">
                          {preview.file.name}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-full"
                          onClick={() => removeEvidencePreview(preview.id)}
                          disabled={pending}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              支持 jpeg、png、webp、heic。
            </p>
            {evidenceError ? (
              <p className="text-sm text-destructive">{evidenceError}</p>
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
