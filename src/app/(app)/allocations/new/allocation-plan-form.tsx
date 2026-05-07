"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createAllocationPlanAction,
  type CreateAllocationPlanState,
} from "@/server/allocations";

type AllocationUser = {
  id: string;
  name: string;
  role: "OWNER" | "PARTNER";
};

type AllocationPlanFormProps = {
  project: {
    id: string;
    name: string;
  };
  users: AllocationUser[];
};

const allocationFormSchema = z
  .object({
    effectiveFrom: z.string().min(1, "请选择生效时间"),
    note: z.string().trim().max(500, "备注最多 500 个字").optional(),
    shares: z.record(
      z.string(),
      z
        .string()
        .trim()
        .regex(/^(\d+|\d+\.\d{1,2})$/, "百分比最多保留 2 位小数")
        .refine((value) => Number(value) >= 0, "比例不能小于 0%")
        .refine((value) => Number(value) <= 100, "比例不能超过 100%")
    ),
  })
  .refine(
    (value) =>
      Object.values(value.shares).reduce(
        (total, share) => total + Math.round(Number(share) * 100),
        0
      ) === 10000,
    "分配比例合计必须等于 100%"
  );

type AllocationFormValues = z.infer<typeof allocationFormSchema>;

const initialState: CreateAllocationPlanState = {};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatPercentFromBasisPoints(basisPoints: number) {
  return (basisPoints / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function roleLabel(role: AllocationUser["role"]) {
  return role === "OWNER" ? "老板" : "合伙人";
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "保存中..." : "保存"}
    </Button>
  );
}

export function AllocationPlanForm({
  project,
  users,
}: AllocationPlanFormProps) {
  const [state, formAction, pending] = useActionState(
    createAllocationPlanAction,
    initialState
  );
  const lastErrorRef = useRef<string | undefined>(undefined);
  const defaultShares = useMemo(
    () =>
      users.reduce<Record<string, string>>((result, user) => {
        result[user.id] = "";
        return result;
      }, {}),
    [users]
  );
  const {
    register,
    watch,
    trigger,
    formState: { errors },
  } = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    mode: "onBlur",
    defaultValues: {
      effectiveFrom: todayString(),
      note: "",
      shares: defaultShares,
    },
  });
  const shares = watch("shares");
  const totalBasisPoints = users.reduce((total, user) => {
    const value = shares?.[user.id];
    const numericValue = value === undefined || value === "" ? 0 : Number(value);

    if (Number.isNaN(numericValue)) {
      return total;
    }

    return total + Math.round(numericValue * 100);
  }, 0);
  const totalPercent = formatPercentFromBasisPoints(totalBasisPoints);
  const hasValidTotal = totalBasisPoints === 10000;

  useEffect(() => {
    if (state.error && state.error !== lastErrorRef.current) {
      toast.error(state.error);
      lastErrorRef.current = state.error;
    }
  }, [state.error]);

  return (
    <form
      action={async (formData) => {
        const isValid = await trigger();

        if (!isValid || !hasValidTotal) {
          toast.error("请检查分配方案，合计必须等于 100%");
          return;
        }

        formAction(formData);
      }}
    >
      <input type="hidden" name="projectId" value={project.id} />
      <Card>
        <CardHeader>
          <CardTitle>新方案</CardTitle>
          <CardDescription>
            录入后成为该项目在生效时间之后的分配依据。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="projectName">项目</Label>
              <Input id="projectName" value={project.name} readOnly />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">生效时间</Label>
              <Input
                id="effectiveFrom"
                type="date"
                disabled={pending}
                aria-invalid={Boolean(errors.effectiveFrom)}
                {...register("effectiveFrom")}
              />
              {errors.effectiveFrom?.message ? (
                <p className="text-sm text-destructive">
                  {errors.effectiveFrom.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">备注</Label>
            <Textarea
              id="note"
              placeholder="例如：老板拍板 image2 首版分配"
              disabled={pending}
              aria-invalid={Boolean(errors.note)}
              {...register("note")}
            />
            {errors.note?.message ? (
              <p className="text-sm text-destructive">{errors.note.message}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-medium">分配方案</h2>
                <p className="text-sm text-muted-foreground">
                  按百分比录入，系统保存为万分比。
                </p>
              </div>
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  hasValidTotal ? "text-emerald-700" : "text-destructive"
                )}
              >
                合计 {totalPercent}%
              </p>
            </div>

            <div className="rounded-lg border">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="grid gap-3 border-b p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_180px]"
                >
                  <div className="min-w-0">
                    <Label htmlFor={`percent-${user.id}`}>{user.name}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {roleLabel(user.role)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="hidden"
                      value={Math.round(Number(shares?.[user.id] || 0) * 100)}
                      name={`share:${user.id}`}
                    />
                    <Input
                      id={`percent-${user.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="百分比 (0-100)"
                      disabled={pending}
                      aria-invalid={Boolean(errors.shares?.[user.id])}
                      {...register(`shares.${user.id}`)}
                    />
                    {errors.shares?.[user.id]?.message ? (
                      <p className="text-sm text-destructive">
                        {errors.shares[user.id]?.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {!hasValidTotal ? (
              <p className="text-sm text-destructive" role="alert">
                合计必须等于 100% 后才能保存。
              </p>
            ) : (
              <p className="text-sm text-emerald-700">合计 100%</p>
            )}
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
            href="/allocations"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            取消
          </Link>
          <SubmitButton disabled={!hasValidTotal || users.length === 0} />
        </CardFooter>
      </Card>
    </form>
  );
}
