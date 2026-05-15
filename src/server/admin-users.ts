"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export type AddPartnerState = {
  success?: boolean;
  userId?: string;
  error?: string;
};
export type EditUserState = { success?: boolean; error?: string };

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

const passwordSchema = z
  .string()
  .min(8, passwordStrengthMessage)
  .refine(
    (password) =>
      !/^\d+$/.test(password) &&
      !commonWeakPasswords.has(password.trim().toLowerCase()),
    passwordStrengthMessage
  );

const addPartnerSchema = z.object({
  email: z.string().trim().email("邮箱格式不对"),
  name: z.string().trim().min(1, "姓名不能为空").max(50, "姓名最多 50 个字"),
  password: passwordSchema,
});

const editUserSchema = z.object({
  id: z.string().min(1, "用户不存在"),
  name: z.string().trim().min(1, "姓名不能为空").max(50, "姓名最多 50 个字"),
  newPassword: z.preprocess(
    (value) => (value === "" ? undefined : value),
    passwordSchema.optional()
  ),
});

export async function addPartnerAction(
  _prevState: AddPartnerState,
  formData: FormData
): Promise<AddPartnerState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以加合伙人" };
  }

  const parsed = addPartnerSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "请检查输入" };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "邮箱已被使用" };

  const passwordHash = await hash(parsed.data.password, 10);
  try {
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: UserRole.PARTNER,
      },
    });
    revalidatePath("/admin/users");
    return { success: true, userId: created.id };
  } catch (error) {
    console.error("add partner failed", error);
    return { error: "添加失败" };
  }
}

export async function editUserAction(
  _prevState: EditUserState,
  formData: FormData
): Promise<EditUserState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "OWNER") {
    return { error: "只有老板可以编辑用户" };
  }

  const parsed = editUserSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    newPassword: formData.get("newPassword") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "请检查输入" };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.id },
    select: { role: true },
  });
  if (!target) return { error: "用户不存在" };
  // 不能改 role (避免误操作把 OWNER 降成 PARTNER 或反之)
  // 不能改 email (readonly, 业务唯一标识)

  const data: { name: string; passwordHash?: string } = {
    name: parsed.data.name,
  };
  if (parsed.data.newPassword) {
    data.passwordHash = await hash(parsed.data.newPassword, 10);
  }

  try {
    await prisma.user.update({ where: { id: parsed.data.id }, data });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${parsed.data.id}/edit`);
    return { success: true };
  } catch (error) {
    console.error("edit user failed", error);
    return { error: "保存失败" };
  }
}
