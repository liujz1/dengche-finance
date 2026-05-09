import { test, expect } from "@playwright/test";

const BOSS = { email: "boss@dengche.local", password: "boss123456" };
const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };

async function login(page: any, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(email);
  await page.getByLabel(/密码|password/i).fill(password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me|allocations|approvals)/, { timeout: 10_000 });
}

test("boss 登录后能访问 /projects 不爆", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await login(page, BOSS.email, BOSS.password);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/projects/);

  expect(consoleErrors, `客户端报错:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test("boss 全站 smoke (主要页面 200 + 不爆)", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} → pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`${page.url()} → console.error: ${msg.text()}`);
  });

  await login(page, BOSS.email, BOSS.password);

  for (const path of ["/projects", "/projects/new", "/entries/new", "/approvals", "/allocations", "/allocations/new"]) {
    const resp = await page.goto(path);
    expect(resp?.status(), `${path} status`).toBeLessThan(500);
  }

  expect(consoleErrors, `boss 全站客户端报错:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test("partner-a 登录 + 看 /me /entries/new", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} → pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`${page.url()} → console.error: ${msg.text()}`);
  });

  await login(page, PARTNER_A.email, PARTNER_A.password);

  for (const path of ["/me", "/projects", "/entries/new"]) {
    const resp = await page.goto(path);
    expect(resp?.status(), `${path} status`).toBeLessThan(500);
  }

  expect(consoleErrors, `partner-a 客户端报错:\n${consoleErrors.join("\n")}`).toEqual([]);
});
