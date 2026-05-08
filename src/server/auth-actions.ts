"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";

const signinSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(6),
  callbackUrl: z.string().optional(),
});

export type SigninState = {
  error?: string;
};

function safeCallbackUrl(value: string | undefined) {
  if (!value) {
    return "/projects";
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const parsedUrl = new URL(value);
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return "/projects";
  }
}

export async function signinAction(
  _prevState: SigninState,
  formData: FormData
): Promise<SigninState> {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl"),
  });

  if (!parsed.success) {
    return { error: "邮箱或密码错误" };
  }

  const callbackUrl = safeCallbackUrl(parsed.data.callbackUrl);

  // NextAuth v5: signIn() 失败时会 throw CredentialsSignin Error (不是 return),
  // 必须 catch 后返回友好提示, 否则 propagate 到 UI 变 Runtime Error 页面.
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    // CredentialsSignin = 验证失败 (用户输错邮箱/密码)
    const errorName =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : "";
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? "");

    if (
      errorName === "CredentialsSignin" ||
      errorMessage.includes("CredentialsSignin")
    ) {
      return { error: "邮箱或密码错误" };
    }

    // 其它未知 error 也按友好提示, 但留 console 痕迹便于排错
    console.error("signinAction unexpected error:", error);
    return { error: "登录失败, 请稍后重试" };
  }

  // signIn 成功才走到这里 — redirect 到 callbackUrl
  redirect(callbackUrl);
}
