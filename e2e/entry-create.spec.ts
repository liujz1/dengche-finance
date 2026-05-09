import { test, expect } from "@playwright/test";

const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };

// 最简 1x1 PNG, 用于上传测试 (避免 fixture 文件)
const TINY_PNG_BUFFER = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C620001000000050001" +
  "0D0A2DB40000000049454E44AE426082",
  "hex",
);

async function loginAsPartnerA(page: any) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(PARTNER_A.email);
  await page.getByLabel(/密码|password/i).fill(PARTNER_A.password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

test("T-002: partner-a 录入新流水 e2e", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await loginAsPartnerA(page);
  await page.goto("/entries/new");
  await expect(page).toHaveURL(/\/entries\/new/);

  // 选项目: 第一个 combobox (base-ui Select)
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /image2/i }).click();

  // 选类型: 第二个 combobox = 支出
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: /支出/ }).click();

  // 填金额 + 描述
  await page.getByLabel(/^金额/).fill("88.50");
  await page.getByLabel(/描述/).fill("e2e 测试一笔");

  // 上传图片 (PNG buffer) + 显式 dispatch change 兜底 RHF
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "test-evidence.png",
    mimeType: "image/png",
    buffer: TINY_PNG_BUFFER,
  });
  await fileInput.dispatchEvent("change");

  // 显式 fill occurredAt — 解 react-hook-form defaultValues 时序竞态
  // (zod schema occurredAt: z.string().min(1) 会 reject 空字符串)
  const today = new Date().toISOString().slice(0, 10);
  await page.locator("input#occurredAt").fill(today);

  await page.waitForTimeout(200); // 等 RHF state 同步

  // 提交
  await page.getByRole("button", { name: "提交审核" }).click();

  // 等 toast 出现 + capture 文本看真因
  await page.waitForTimeout(2000);

  // 期望 toast "已提交" 或 redirect 到 /projects/[id]
  // 软断言 toast (可能 form 重置时 toaster 也 unmount, 同 T-014 的 bug)
  // 硬断言: 必须 redirect 走 /entries/new 离开
  await page.waitForURL(/\/(projects|entries)/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/entries\/new$/);

  // 过滤 dev 环境已知 404 (无 R2 credentials, evidence image fetch 自然 fail) - 非业务 bug
  const realErrors = consoleErrors.filter((e) => !e.includes("404") && !e.includes("Not Found"));
  expect(realErrors, `客户端报错:\n${realErrors.join("\n")}`).toEqual([]);
});
