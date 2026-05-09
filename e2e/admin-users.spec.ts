import { test, expect } from "@playwright/test";

const BOSS = { email: "boss@dengche.local", password: "boss123456" };
const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };

async function login(page: any, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(email);
  await page.getByLabel(/密码|password/i).fill(password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

test("T-040: boss 看 /admin/users 列表渲染 (含 3 个 seed 用户)", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await login(page, BOSS.email, BOSS.password);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/users/);

  // 看到三个 seed 邮箱
  const bodyText = await page.locator("body").textContent();
  expect(bodyText).toContain("boss@dengche.local");
  expect(bodyText).toContain("partner-a@dengche.local");
  expect(bodyText).toContain("partner-b@dengche.local");

  // 添加合伙人按钮可见
  await expect(page.getByRole("link", { name: /添加合伙人/ })).toBeVisible();

  const realErrors = consoleErrors.filter((e) => !e.includes("404") && !e.includes("Not Found"));
  expect(realErrors, `客户端报错:\n${realErrors.join("\n")}`).toEqual([]);
});

test("T-040: partner-a 不能看 /admin/users (应 redirect 走)", async ({ page }) => {
  await login(page, PARTNER_A.email, PARTNER_A.password);
  await page.goto("/admin/users");

  // OWNER-only, 应被 redirect
  await page.waitForURL(/\/projects/, { timeout: 5_000 });
  await expect(page).toHaveURL(/\/projects/);
});

test("T-040: nav 用户链接仅 OWNER 可见", async ({ page }) => {
  // boss 应该看到
  await login(page, BOSS.email, BOSS.password);
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: /^用户$/ }).first()).toBeVisible();

  // partner-a 不应看到
  await page.context().clearCookies();
  await login(page, PARTNER_A.email, PARTNER_A.password);
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: /^用户$/ })).toHaveCount(0);
});
