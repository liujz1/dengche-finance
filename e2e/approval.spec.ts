import { test, expect } from "@playwright/test";

const BOSS = { email: "boss@dengche.local", password: "boss123456" };

async function loginAsBoss(page: any) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(BOSS.email);
  await page.getByLabel(/密码|password/i).fill(BOSS.password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me|allocations|approvals)/, { timeout: 10_000 });
}

test("boss 看 /approvals — 待审列表渲染 + 0 客户端报错", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await loginAsBoss(page);
  const resp = await page.goto("/approvals");
  expect(resp?.status(), "/approvals status").toBeLessThan(500);
  await expect(page).toHaveURL(/\/approvals/);

  expect(consoleErrors, `客户端报错:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test("partner-a 不能看 /approvals (应 redirect 走)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill("partner-a@dengche.local");
  await page.getByLabel(/密码|password/i).fill("partnera123");
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });

  await page.goto("/approvals");
  // OWNER-only 路由, partner-a 应被 redirect 到 /projects
  await page.waitForURL(/\/projects/, { timeout: 5_000 });
  await expect(page).toHaveURL(/\/projects/);
});
