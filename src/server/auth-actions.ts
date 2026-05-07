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
  const redirectUrl = await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
    redirectTo: callbackUrl,
  });

  if (typeof redirectUrl === "string") {
    const url = new URL(redirectUrl, "http://localhost");

    if (url.searchParams.get("error")) {
      return { error: "邮箱或密码错误" };
    }
  }

  redirect(callbackUrl);
}
