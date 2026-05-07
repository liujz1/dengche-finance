"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, use } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signinAction, type SigninState } from "@/server/auth-actions";

const loginSchema = z.object({
  email: z.email({ error: "请输入有效邮箱" }).trim().toLowerCase(),
  password: z.string().min(6, "密码至少 6 位"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const initialState: SigninState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="mt-2 w-full" disabled={pending}>
      {pending ? "登录中..." : "登录"}
    </Button>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = use(searchParams);
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/projects";
  const [state, formAction, pending] = useActionState(
    signinAction,
    initialState
  );
  const {
    register,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          disabled={pending}
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email?.message ? (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={pending}
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password?.message ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      {state.error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">登录失败</p>
          <p>{state.error}</p>
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
