import { test, expect } from "@playwright/test";

const BOSS = { email: "boss@dengche.local", password: "boss123456" };

async function login(page: any, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(email);
  await page.getByLabel(/密码|password/i).fill(password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

// T-217 真验证: 审核弹窗打开后, 不滚动, "通过"按钮就必须在视口内可见。
// 关键: toBeInViewport() 直接查当前可见性, 不像 .click() 会自动滚动。
test("T-217: 审核弹窗通过按钮不滚动就在视口内", async ({ page }) => {
  await login(page, BOSS.email, BOSS.password);
  await page.goto("/approvals");

  const viewBtnCount = await page.getByRole("button", { name: "查看" }).count();
  test.skip(viewBtnCount === 0, "无待审流水, 跳过");

  await page.getByRole("button", { name: "查看" }).first().click();
  await expect(
    page.getByRole("heading", { name: "审核流水" })
  ).toBeVisible();

  // 截图: 弹窗刚打开、未滚动的真实视口状态
  await page.screenshot({
    path: "test-results/approval-viewport-check.png",
    fullPage: false,
  });

  // 真断言: 通过按钮当前就在视口内 (不滚动)
  await expect(page.getByRole("button", { name: /^通过$/ })).toBeInViewport();
  // 驳回按钮同理
  await expect(page.getByRole("button", { name: /^驳回$/ })).toBeInViewport();
});
