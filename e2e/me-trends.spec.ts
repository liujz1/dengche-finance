import { test, expect } from "@playwright/test";

const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };

async function loginAsPartnerA(page: any) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(PARTNER_A.email);
  await page.getByLabel(/密码|password/i).fill(PARTNER_A.password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

test("T-005: partner-a 看 /me 趋势曲线", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await loginAsPartnerA(page);
  await page.goto("/me");
  await expect(page).toHaveURL(/\/me/);

  // 看到至少一个项目卡片 + 趋势 chart 渲染 (recharts svg)
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 5_000 });

  // 项目名应该出现 (image2 / windsurf 至少一个)
  const bodyText = await page.locator("body").textContent();
  expect(bodyText).toMatch(/image2|windsurf/);

  const realErrors = consoleErrors.filter((e) => !e.includes("404") && !e.includes("Not Found"));
  expect(realErrors, `客户端报错:\n${realErrors.join("\n")}`).toEqual([]);
});
