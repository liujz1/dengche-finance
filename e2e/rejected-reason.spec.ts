import Database from "better-sqlite3";
import { expect, test, type Page } from "@playwright/test";

const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };
const BOSS = { email: "boss@dengche.local", password: "boss123456" };
const REJECTED_ENTRY_IDS = [
  "e2e_t310_rejected_entry",
  "e2e_t312_rejected_entry_second",
] as const;
const OTHER_PARTNER_REJECTED_ENTRY_ID = "e2e_t312_other_partner_rejected_entry";
const OWNER_REJECTED_ENTRY_ID = "e2e_t312_owner_rejected_entry";
const PROJECT_ID = "seed_project_image2";
const REJECTED_REASON = "凭证金额和流水金额不一致，请补充正确截图";

function databasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  return databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
}

function deleteEntry(db: Database.Database, entryId: string) {
  db.prepare("DELETE FROM LedgerEvent WHERE entryId = ?").run(entryId);
  db.prepare("DELETE FROM Evidence WHERE entryId = ?").run(entryId);
  db.prepare("DELETE FROM Entry WHERE id = ?").run(entryId);
}

function insertRejectedEntry(params: {
  db: Database.Database;
  entryId: string;
  createdById: string;
  description: string;
  amountCents: number;
  occurredAt: string;
  now: string;
}) {
  const {
    db,
    entryId,
    createdById,
    description,
    amountCents,
    occurredAt,
    now,
  } = params;

  db.prepare(
    `INSERT INTO Entry (
      id, projectId, type, amountCents, description, occurredAt, status,
      createdById, approvedById, approvedAt, rejectedReason, reversedFromId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    entryId,
    PROJECT_ID,
    "EXPENSE",
    amountCents,
    description,
    occurredAt,
    "REJECTED",
    createdById,
    "seed_user_owner",
    now,
    REJECTED_REASON,
    now
  );
  db.prepare(
    "INSERT INTO LedgerEvent (id, entryId, projectId, eventType, payloadJson, actorId, occurredAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    `${entryId}_created`,
    entryId,
    PROJECT_ID,
    "ENTRY_CREATED",
    JSON.stringify({
      entryId,
      eventType: "ENTRY_CREATED",
      status: "PENDING",
      description,
      amountCents,
    }),
    createdById,
    occurredAt
  );
  db.prepare(
    "INSERT INTO LedgerEvent (id, entryId, projectId, eventType, payloadJson, actorId, occurredAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    `${entryId}_rejected`,
    entryId,
    PROJECT_ID,
    "ENTRY_REJECTED",
    JSON.stringify({
      entryId,
      eventType: "ENTRY_REJECTED",
      status: "REJECTED",
      rejectedReason: REJECTED_REASON,
    }),
    "seed_user_owner",
    now
  );
}

function resetRejectedEntries() {
  const db = new Database(databasePath());
  const now = new Date().toISOString();
  const occurredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  db.transaction(() => {
    cleanupRejectedEntriesInTransaction(db);
    insertRejectedEntry({
      db,
      entryId: REJECTED_ENTRY_IDS[0],
      createdById: "seed_user_partner_a",
      description: "T-310 驳回原因可见性测试",
      amountCents: 8800,
      occurredAt: occurredAt.toISOString(),
      now,
    });
    insertRejectedEntry({
      db,
      entryId: REJECTED_ENTRY_IDS[1],
      createdById: "seed_user_partner_a",
      description: "T-312 第二条本人驳回提醒测试",
      amountCents: 6600,
      occurredAt: new Date(occurredAt.getTime() - 60 * 60 * 1000).toISOString(),
      now,
    });
    insertRejectedEntry({
      db,
      entryId: OTHER_PARTNER_REJECTED_ENTRY_ID,
      createdById: "seed_user_partner_b",
      description: "T-312 他人驳回不计入本人",
      amountCents: 5500,
      occurredAt: new Date(occurredAt.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      now,
    });
  })();

  db.close();
}

function resetOwnerRejectedEntry() {
  const db = new Database(databasePath());
  const now = new Date().toISOString();
  const occurredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  db.transaction(() => {
    cleanupRejectedEntriesInTransaction(db);
    insertRejectedEntry({
      db,
      entryId: OWNER_REJECTED_ENTRY_ID,
      createdById: "seed_user_owner",
      description: "T-312 老板本人驳回不提醒",
      amountCents: 7700,
      occurredAt,
      now,
    });
  })();

  db.close();
}

function cleanupRejectedEntriesInTransaction(db: Database.Database) {
  for (const entryId of [
    ...REJECTED_ENTRY_IDS,
    OTHER_PARTNER_REJECTED_ENTRY_ID,
    OWNER_REJECTED_ENTRY_ID,
  ]) {
    deleteEntry(db, entryId);
  }
}

function cleanupRejectedEntries() {
  const db = new Database(databasePath());

  db.transaction(() => cleanupRejectedEntriesInTransaction(db))();

  db.close();
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(user.email);
  await page.getByLabel(/密码|password/i).fill(user.password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

test.describe.serial("T-310 合伙人看到驳回原因", () => {
  test.beforeEach(() => {
    resetRejectedEntries();
  });

  test.afterAll(() => {
    cleanupRejectedEntries();
  });

  test("partner-a 在 /me 看到原因并能点进流水详情", async ({ page }) => {
    await login(page, PARTNER_A);
    await page.goto("/me");

    await expect(page.getByText("T-310 驳回原因可见性测试")).toBeVisible();
    // 两条被驳回流水共用同一 REJECTED_REASON，会匹配多个元素，取首个即可
    await expect(
      page.getByText(`驳回原因：${REJECTED_REASON}`).first()
    ).toBeVisible();

    await page.getByText("T-310 驳回原因可见性测试").click();
    await page.waitForURL(new RegExp(`/projects/${PROJECT_ID}/${REJECTED_ENTRY_IDS[0]}`));
    await expect(page.getByText(`已驳回 · 原因：${REJECTED_REASON}`)).toBeVisible();
  });

  test("T-312: partner-a 有驳回流水时导航徽章和 /me 横幅显示本人数量", async ({ page }) => {
    await login(page, PARTNER_A);

    const navMyReturns = page
      .getByRole("navigation")
      .getByRole("link", { name: /我的回报/ });
    await expect(navMyReturns).toHaveAttribute(
      "aria-label",
      "我的回报，2 笔被驳回流水"
    );
    await expect(navMyReturns.getByText("2", { exact: true })).toBeVisible();

    await page.goto("/me");
    await expect(
      page.getByText(
        "你有 2 笔流水被驳回，见下方历史流水，请按驳回原因修正后重新提交。"
      )
    ).toBeVisible();
  });

  test("T-312: partner-a 没有驳回流水时不显示导航徽章和 /me 横幅", async ({ page }) => {
    cleanupRejectedEntries();

    await login(page, PARTNER_A);

    const navMyReturns = page
      .getByRole("navigation")
      .getByRole("link", { name: "我的回报" });
    await expect(navMyReturns).toHaveAttribute("aria-label", "我的回报");
    await expect(navMyReturns.getByText("2", { exact: true })).toHaveCount(0);

    await page.goto("/me");
    await expect(page.getByText(/你有 \d+ 笔流水被驳回/)).toHaveCount(0);
  });

  test("T-312: OWNER 不显示驳回提醒", async ({ page }) => {
    resetOwnerRejectedEntry();

    await login(page, BOSS);

    const navMyReturns = page
      .getByRole("navigation")
      .getByRole("link", { name: "我的回报" });
    await expect(navMyReturns).toHaveAttribute("aria-label", "我的回报");
    await expect(navMyReturns.getByText("1", { exact: true })).toHaveCount(0);

    await page.goto("/me");
    await expect(page.getByText(/你有 \d+ 笔流水被驳回/)).toHaveCount(0);
  });
});
