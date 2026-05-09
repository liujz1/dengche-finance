import { test, expect } from "@playwright/test";

const BOSS = { email: "boss@dengche.local", password: "boss123456" };
const IMAGE2_ID = "seed_project_image2";

async function loginAsBoss(page: any) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(BOSS.email);
  await page.getByLabel(/密码|password/i).fill(BOSS.password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

test("T-021: boss 看 entry 审计时间线 page 渲染 + 0 报错", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await loginAsBoss(page);
  // 用 seed 已有 entry id (淘宝收款那条 APPROVED)
  await page.goto(`/projects/${IMAGE2_ID}/seed_entry_image2_taobao_income`);

  // 看到时间线 + 至少 1 个事件 (创建 / 通过)
  await expect(page.getByRole("heading", { name: "流水审计时间线" })).toBeVisible({ timeout: 5_000 });
  // 应该至少有"创建"或"通过"event badge
  const bodyText = await page.locator("body").textContent();
  expect(bodyText).toMatch(/创建|通过/);

  const realErrors = consoleErrors.filter((e) => !e.includes("404") && !e.includes("Not Found"));
  expect(realErrors, `客户端报错:\n${realErrors.join("\n")}`).toEqual([]);
});
