import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";

const BOSS = { email: "boss@dengche.local", password: "boss123456" };
const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };
const IMAGE2_ID = "seed_project_image2";
const WINDSURF_ID = "seed_project_windsurf";
const DELETE_ENTRY_ID = "seed_entry_image2_adobe_expense";
const WINDSURF_PENDING_ID = "seed_entry_windsurf_pending_review";
const WINDSURF_EXPENSE_ID = "seed_entry_windsurf_account_expense";

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
    // 恢复 windsurf 待审流水——"行内删除"测试会删它, 不恢复则双引擎跑时
    // 第二个引擎找不到这条流水。
    db.prepare("DELETE FROM Evidence WHERE entryId = ?").run(WINDSURF_PENDING_ID);
    db.prepare("UPDATE LedgerEvent SET entryId = NULL WHERE entryId = ?").run(
      WINDSURF_PENDING_ID
    );
    db.prepare("DELETE FROM Entry WHERE id = ?").run(WINDSURF_PENDING_ID);
    db.prepare(
      "INSERT INTO Entry (id, projectId, type, amountCents, description, occurredAt, status, createdById, approvedById, approvedAt, rejectedReason, reversedFromId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?)"
    ).run(
      WINDSURF_PENDING_ID,
      WINDSURF_ID,
      "EXPENSE",
      8_800,
      "服务器续费 ¥88 待审",
      occurredAt,
      "PENDING",
      "seed_user_partner_a",
      now
    );
    // 恢复 windsurf 已审核流水 + 清掉上一轮"删除冲销配对"测试产生的冲销条。
    // 先删冲销条(它的 reversedFromId 指向原始条, 否则删原始条会撞外键)。
    db.prepare("DELETE FROM Entry WHERE description LIKE ?").run(
      "[冲销] windsurf 号采购%"
    );
    db.prepare("DELETE FROM Evidence WHERE entryId = ?").run(WINDSURF_EXPENSE_ID);
    db.prepare("UPDATE LedgerEvent SET entryId = NULL WHERE entryId = ?").run(
      WINDSURF_EXPENSE_ID
    );
    db.prepare("DELETE FROM Entry WHERE id = ?").run(WINDSURF_EXPENSE_ID);
    db.prepare(
      "INSERT INTO Entry (id, projectId, type, amountCents, description, occurredAt, status, createdById, approvedById, approvedAt, rejectedReason, reversedFromId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)"
    ).run(
      WINDSURF_EXPENSE_ID,
      WINDSURF_ID,
      "EXPENSE",
      29_900,
      "windsurf 号采购 ¥299",
      occurredAt,
      "APPROVED",
      "seed_user_owner",
      "seed_user_owner",
      now,
      occurredAt
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
    // 恢复后该项目应离开归档列表。不能用 getByText("已归档")——空状态文案
    // "还没有已归档项目" 含该子串会被模糊匹配命中，改用项目描述精确判断。
    await expect(
      page.getByText("windsurf (Pro 号家人自用 + 服务器化)")
    ).toHaveCount(0, { timeout: 10_000 });

    await page.goto("/projects");
    await expect(page.getByText("windsurf (Pro 号家人自用 + 服务器化)")).toBeVisible();
  });

  // image2 已审核流水的合计盈亏（INCOME 计正、EXPENSE/PROXY_PAY 计负，
  // 与 src/lib/amount.ts signedProfitAmountCents 一致）。用相对断言，
  // 不硬编码绝对值——全套 e2e 里 image2 会被别的 spec 塞流水。
  function image2ApprovedProfitCents() {
    const db = new Database(databasePath());
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(CASE
            WHEN type = 'INCOME' THEN amountCents
            WHEN type IN ('EXPENSE', 'PROXY_PAY') THEN -amountCents
            ELSE 0 END), 0) AS profit
          FROM Entry WHERE projectId = ? AND status = 'APPROVED'`
      )
      .get(IMAGE2_ID) as { profit: number };
    db.close();
    return row.profit;
  }

  test("OWNER 删除流水后合计变化且 DB 留 ENTRY_DELETED", async ({ page }) => {
    const db = new Database(databasePath());
    const before = db
      .prepare("SELECT amountCents FROM Entry WHERE id = ?")
      .get(DELETE_ENTRY_ID) as { amountCents: number };
    db.close();

    const profitBefore = image2ApprovedProfitCents();

    await login(page, BOSS.email, BOSS.password);
    await page.goto(`/projects/${IMAGE2_ID}/${DELETE_ENTRY_ID}`);
    await page.getByRole("button", { name: /删除流水/ }).click();
    await page.locator('textarea[name="reason"]').fill("T-303 e2e 删除测试");
    await page.getByRole("button", { name: "确认删除" }).click();
    await page.waitForURL(`/projects/${IMAGE2_ID}`, { timeout: 10_000 });

    // 精确匹配——别的 spec 留下的反向冲销流水描述含 "Adobe 账号采购 ¥120"
    // 这段子串，模糊匹配会误命中。被删流水的描述恰好就是这一整串。
    await expect(
      page.getByText("Adobe 账号采购 ¥120", { exact: true })
    ).toHaveCount(0);

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

    const profitAfter = image2ApprovedProfitCents();

    expect(before.amountCents).toBe(12_000);
    // 删掉一条已审核的 EXPENSE，合计盈亏应上升被删金额
    expect(profitAfter - profitBefore).toBe(12_000);
    // better-sqlite3 .get() 查不到行返回 undefined（不是 null）
    expect(deletedEntry).toBeUndefined();
    expect(deletedEvent).toBeDefined();
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

  test("OWNER 在项目流水列表行内直接删除流水", async ({ page }) => {
    await login(page, BOSS.email, BOSS.password);
    await page.goto(`/projects/${WINDSURF_ID}`);

    const targetRow = page
      .getByRole("row")
      .filter({ hasText: "服务器续费 ¥88 待审" });
    await expect(targetRow).toHaveCount(1);

    await targetRow.getByRole("button", { name: /删除流水/ }).click();
    await page.locator('textarea[name="reason"]').fill("e2e 行内删除测试");
    await page.getByRole("button", { name: "确认删除" }).click();
    await page.waitForURL(`/projects/${WINDSURF_ID}`, { timeout: 10_000 });

    await expect(
      page.getByText("服务器续费 ¥88 待审", { exact: true })
    ).toHaveCount(0);
  });

  test("OWNER 删除冲销过的流水时整对一起删", async ({ page }) => {
    await login(page, BOSS.email, BOSS.password);
    await page.goto(`/projects/${WINDSURF_ID}`);

    // 先把一条已审核流水反向冲销，制造一对冲销配对
    await page
      .getByRole("row")
      .filter({ hasText: "windsurf 号采购 ¥299" })
      .getByRole("button", { name: /反向冲销/ })
      .click();
    await page.locator('textarea[name="reason"]').fill("e2e冲销原因");
    await page.getByRole("button", { name: /确认冲销/ }).click();
    await page.waitForTimeout(3000);

    // 冲销条出现在列表里
    const reversalRow = page
      .getByRole("row")
      .filter({ hasText: "[冲销] windsurf 号采购 ¥299" });
    await expect(reversalRow).toHaveCount(1);

    // 删除冲销条 —— 应把整对（原始条 + 冲销条）一起删。
    // 用唯一原因，避免 Chromium + WebKit 双引擎跑时事件计数互相累加。
    const pairReason = `e2e配对删除-${Date.now()}`;
    await reversalRow.getByRole("button", { name: /删除流水/ }).click();
    await page.locator('textarea[name="reason"]').fill(pairReason);
    await page.getByRole("button", { name: "确认删除" }).click();

    // 删完重定向回本项目页（URL 不变），UI 信号不可靠——直接轮询 DB，
    // 等配对删除真正落库（原始条 + 冲销条都没了）。
    await expect
      .poll(
        () => {
          const probe = new Database(databasePath());
          const orig = probe
            .prepare("SELECT id FROM Entry WHERE id = ?")
            .get("seed_entry_windsurf_account_expense");
          const rev = probe
            .prepare(
              "SELECT COUNT(*) AS n FROM Entry WHERE description LIKE ?"
            )
            .get("[冲销] windsurf 号采购%") as { n: number };
          probe.close();
          return orig === undefined && rev.n === 0;
        },
        { timeout: 10_000 }
      )
      .toBe(true);

    // 配对的两条各留一条 ENTRY_DELETED 审计
    const db = new Database(databasePath());
    const deletedEvents = db
      .prepare(
        "SELECT COUNT(*) AS n FROM LedgerEvent WHERE eventType = 'ENTRY_DELETED' AND payloadJson LIKE ?"
      )
      .get(`%${pairReason}%`) as { n: number };
    db.close();
    expect(deletedEvents.n).toBe(2);
  });
});
