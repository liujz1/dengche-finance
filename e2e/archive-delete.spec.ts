import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";

const BOSS = { email: "boss@dengche.local", password: "boss123456" };
const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };
const IMAGE2_ID = "seed_project_image2";
const WINDSURF_ID = "seed_project_windsurf";
const DELETE_ENTRY_ID = "seed_entry_image2_adobe_expense";

function databasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  return databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
}

function resetSeedState() {
  const db = new Database(databasePath());
  const now = new Date().toISOString();
  const occurredAt = new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString();

  db.transaction(() => {
    db.prepare("UPDATE Project SET active = 1 WHERE id IN (?, ?)").run(
      IMAGE2_ID,
      WINDSURF_ID
    );
    db.prepare("DELETE FROM Evidence WHERE entryId = ?").run(DELETE_ENTRY_ID);
    db.prepare("UPDATE LedgerEvent SET entryId = NULL WHERE entryId = ?").run(
      DELETE_ENTRY_ID
    );
    db.prepare("DELETE FROM Entry WHERE id = ?").run(DELETE_ENTRY_ID);
    db.prepare(
      "INSERT INTO Entry (id, projectId, type, amountCents, description, occurredAt, status, createdById, approvedById, approvedAt, rejectedReason, reversedFromId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)"
    ).run(
      DELETE_ENTRY_ID,
      IMAGE2_ID,
      "EXPENSE",
      12_000,
      "Adobe 账号采购 ¥120",
      occurredAt,
      "APPROVED",
      "seed_user_owner",
      "seed_user_owner",
      now,
      occurredAt
    );
    db.prepare(
      "UPDATE LedgerEvent SET entryId = ?, projectId = ?, eventType = ?, payloadJson = ?, actorId = ? WHERE id = ?"
    ).run(
      DELETE_ENTRY_ID,
      IMAGE2_ID,
      "ENTRY_CREATED",
      JSON.stringify({
        seed: true,
        entryId: DELETE_ENTRY_ID,
        eventType: "ENTRY_CREATED",
        status: "PENDING",
        description: "Adobe 账号采购 ¥120",
        amountCents: 12_000,
      }),
      "seed_user_owner",
      `${DELETE_ENTRY_ID}_created`
    );
    db.prepare(
      "UPDATE LedgerEvent SET entryId = ?, projectId = ?, eventType = ?, payloadJson = ?, actorId = ? WHERE id = ?"
    ).run(
      DELETE_ENTRY_ID,
      IMAGE2_ID,
      "ENTRY_APPROVED",
      JSON.stringify({
        seed: true,
        entryId: DELETE_ENTRY_ID,
        eventType: "ENTRY_APPROVED",
        status: "APPROVED",
        description: "Adobe 账号采购 ¥120",
        amountCents: 12_000,
      }),
      "seed_user_owner",
      `${DELETE_ENTRY_ID}_approved`
    );
  })();

  db.close();
}

async function login(page: any, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(email);
  await page.getByLabel(/密码|password/i).fill(password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

test.describe.serial("T-303 项目归档 + 流水删除", () => {
  test.beforeEach(() => {
    resetSeedState();
  });

  test.afterAll(() => {
    resetSeedState();
  });

  test("OWNER 归档项目后列表和录入下拉消失, 并能恢复", async ({ page }) => {
    await login(page, BOSS.email, BOSS.password);

    await page.goto(`/projects/${WINDSURF_ID}`);
    await page.getByRole("button", { name: "归档项目" }).click();
    await expect(page.getByRole("heading", { name: "归档项目" })).toBeVisible();
    await page.getByRole("button", { name: "确认归档" }).click();
    await expect(page.getByText("已归档")).toBeVisible({ timeout: 10_000 });

    await page.goto("/projects");
    await expect(page.getByText("windsurf (Pro 号家人自用 + 服务器化)")).toHaveCount(0);

    await page.goto("/entries/new");
    await page.getByRole("combobox").first().click();
    await expect(page.getByRole("option", { name: /windsurf/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/projects?archived=1");
    await expect(page.getByText("windsurf (Pro 号家人自用 + 服务器化)")).toBeVisible();
    await page.getByRole("button", { name: "恢复项目" }).click();
    await page.getByRole("button", { name: "确认恢复" }).click();
    await expect(page.getByText("已归档")).toHaveCount(0, { timeout: 10_000 });

    await page.goto("/projects");
    await expect(page.getByText("windsurf (Pro 号家人自用 + 服务器化)")).toBeVisible();
  });

  test("OWNER 删除流水后合计变化且 DB 留 ENTRY_DELETED", async ({ page }) => {
    const db = new Database(databasePath());
    const before = db
      .prepare("SELECT amountCents FROM Entry WHERE id = ?")
      .get(DELETE_ENTRY_ID) as { amountCents: number };
    db.close();

    await login(page, BOSS.email, BOSS.password);
    await page.goto(`/projects/${IMAGE2_ID}`);
    await expect(page.getByText("¥768.00")).toBeVisible();

    await page.goto(`/projects/${IMAGE2_ID}/${DELETE_ENTRY_ID}`);
    await page.getByRole("button", { name: /删除流水/ }).click();
    await page.locator('textarea[name="reason"]').fill("T-303 e2e 删除测试");
    await page.getByRole("button", { name: "确认删除" }).click();
    await page.waitForURL(`/projects/${IMAGE2_ID}`, { timeout: 10_000 });

    await expect(page.getByText("¥888.00").first()).toBeVisible();
    await expect(page.getByText("Adobe 账号采购 ¥120")).toHaveCount(0);

    const verifyDb = new Database(databasePath());
    const deletedEntry = verifyDb
      .prepare("SELECT id FROM Entry WHERE id = ?")
      .get(DELETE_ENTRY_ID);
    const deletedEvent = verifyDb
      .prepare(
        "SELECT entryId FROM LedgerEvent WHERE eventType = ? AND projectId = ? AND payloadJson LIKE ? ORDER BY occurredAt DESC LIMIT 1"
      )
      .get("ENTRY_DELETED", IMAGE2_ID, "%T-303 e2e 删除测试%") as
      | { entryId: string | null }
      | undefined;
    verifyDb.close();

    expect(before.amountCents).toBe(12_000);
    expect(deletedEntry).toBeNull();
    expect(deletedEvent).not.toBeNull();
    expect(deletedEvent?.entryId).toBeNull();
  });

  test("PARTNER 看不到归档按钮和删除按钮", async ({ page }) => {
    await login(page, PARTNER_A.email, PARTNER_A.password);

    await page.goto(`/projects/${IMAGE2_ID}`);
    await expect(page.getByRole("button", { name: "归档项目" })).toHaveCount(0);
    await expect(page.getByText("查看已归档")).toHaveCount(0);

    await page.goto(`/projects/${IMAGE2_ID}/seed_entry_image2_taobao_income`);
    await expect(page.getByRole("button", { name: /删除流水/ })).toHaveCount(0);
  });
});
