import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";

const PARTNER_A = { email: "partner-a@dengche.local", password: "partnera123" };
const REJECTED_ENTRY_ID = "e2e_t310_rejected_entry";
const PROJECT_ID = "seed_project_image2";
const REJECTED_REASON = "凭证金额和流水金额不一致，请补充正确截图";

function databasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  return databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
}

function resetRejectedEntry() {
  const db = new Database(databasePath());
  const now = new Date().toISOString();
  const occurredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  db.transaction(() => {
    db.prepare("DELETE FROM LedgerEvent WHERE entryId = ?").run(REJECTED_ENTRY_ID);
    db.prepare("DELETE FROM Evidence WHERE entryId = ?").run(REJECTED_ENTRY_ID);
    db.prepare("DELETE FROM Entry WHERE id = ?").run(REJECTED_ENTRY_ID);
    db.prepare(
      `INSERT INTO Entry (
        id, projectId, type, amountCents, description, occurredAt, status,
        createdById, approvedById, approvedAt, rejectedReason, reversedFromId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).run(
      REJECTED_ENTRY_ID,
      PROJECT_ID,
      "EXPENSE",
      8800,
      "T-310 驳回原因可见性测试",
      occurredAt,
      "REJECTED",
      "seed_user_partner_a",
      "seed_user_owner",
      now,
      REJECTED_REASON,
      now
    );
    db.prepare(
      "INSERT INTO LedgerEvent (id, entryId, projectId, eventType, payloadJson, actorId, occurredAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      `${REJECTED_ENTRY_ID}_created`,
      REJECTED_ENTRY_ID,
      PROJECT_ID,
      "ENTRY_CREATED",
      JSON.stringify({
        entryId: REJECTED_ENTRY_ID,
        eventType: "ENTRY_CREATED",
        status: "PENDING",
        description: "T-310 驳回原因可见性测试",
        amountCents: 8800,
      }),
      "seed_user_partner_a",
      occurredAt
    );
    db.prepare(
      "INSERT INTO LedgerEvent (id, entryId, projectId, eventType, payloadJson, actorId, occurredAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      `${REJECTED_ENTRY_ID}_rejected`,
      REJECTED_ENTRY_ID,
      PROJECT_ID,
      "ENTRY_REJECTED",
      JSON.stringify({
        entryId: REJECTED_ENTRY_ID,
        eventType: "ENTRY_REJECTED",
        status: "REJECTED",
        rejectedReason: REJECTED_REASON,
      }),
      "seed_user_owner",
      now
    );
  })();

  db.close();
}

function cleanupRejectedEntry() {
  const db = new Database(databasePath());

  db.transaction(() => {
    db.prepare("DELETE FROM LedgerEvent WHERE entryId = ?").run(REJECTED_ENTRY_ID);
    db.prepare("DELETE FROM Evidence WHERE entryId = ?").run(REJECTED_ENTRY_ID);
    db.prepare("DELETE FROM Entry WHERE id = ?").run(REJECTED_ENTRY_ID);
  })();

  db.close();
}

async function loginAsPartner(page: any) {
  await page.goto("/login");
  await page.getByLabel(/邮箱|email/i).fill(PARTNER_A.email);
  await page.getByLabel(/密码|password/i).fill(PARTNER_A.password);
  await page.getByRole("button", { name: /登录|sign in/i }).click();
  await page.waitForURL(/\/(projects|me)/, { timeout: 10_000 });
}

test.describe.serial("T-310 合伙人看到驳回原因", () => {
  test.beforeEach(() => {
    resetRejectedEntry();
  });

  test.afterAll(() => {
    cleanupRejectedEntry();
  });

  test("partner-a 在 /me 看到原因并能点进流水详情", async ({ page }) => {
    await loginAsPartner(page);
    await page.goto("/me");

    await expect(page.getByText("T-310 驳回原因可见性测试")).toBeVisible();
    await expect(page.getByText(`驳回原因：${REJECTED_REASON}`)).toBeVisible();

    await page.getByText("T-310 驳回原因可见性测试").click();
    await page.waitForURL(new RegExp(`/projects/${PROJECT_ID}/${REJECTED_ENTRY_ID}`));
    await expect(page.getByText(`已驳回 · 原因：${REJECTED_REASON}`)).toBeVisible();
  });
});
