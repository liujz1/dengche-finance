"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useActionState, useEffect, useRef } from "react";
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
import { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { editUserAction, type EditUserState } from "@/server/admin-users";

type EditUserFormProps = {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
};

const initialState: EditUserState = {};
const passwordStrengthMessage =
  "密码至少 8 位，且不能是纯数字或常见弱密码";
const commonWeakPasswords = new Set([
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "111111",
  "000000",
  "123123",
  "abc123",
  "password",
  "password123",
  "qwerty",
  "qwerty123",
  "admin",
  "letmein",
]);

function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    !/^\d+$/.test(password) &&
    !commonWeakPasswords.has(password.trim().toLowerCase())
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "保存中..." : "保存"}
    </Button>
  );
}

export function EditUserForm({ user }: EditUserFormProps) {
  const [state, formAction] = useActionState(editUserAction, initialState);
  const router = useRouter();
  const lastErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.error && state.error !== lastErrorRef.current) {
      toast.error(state.error);
      lastErrorRef.current = state.error;
    }
  }, [state.error]);

  useEffect(() => {
    if (state.success) {
      toast.success("已保存");
      router.push("/admin/users");
    }
  }, [state.success, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const newPassword = new FormData(event.currentTarget).get("newPassword");
    if (
      typeof newPassword === "string" &&
      newPassword.length > 0 &&
      !isStrongPassword(newPassword)
    ) {
      event.preventDefault();
      toast.error(passwordStrengthMessage);
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>用户资料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="hidden" name="id" value={user.id} />

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" value={user.email} readOnly />
            <p className="text-xs text-muted-foreground">邮箱不可改</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input id="name" name="name" defaultValue={user.name} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">重置密码</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">留空不改</p>
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
            href="/admin/users"
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
