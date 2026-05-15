-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LedgerEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT,
    "projectId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LedgerEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LedgerEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LedgerEvent" ("actorId", "entryId", "eventType", "id", "occurredAt", "payloadJson") SELECT "actorId", "entryId", "eventType", "id", "occurredAt", "payloadJson" FROM "LedgerEvent";
DROP TABLE "LedgerEvent";
ALTER TABLE "new_LedgerEvent" RENAME TO "LedgerEvent";
CREATE INDEX "LedgerEvent_entryId_occurredAt_idx" ON "LedgerEvent"("entryId", "occurredAt");
CREATE INDEX "LedgerEvent_projectId_occurredAt_idx" ON "LedgerEvent"("projectId", "occurredAt");
CREATE INDEX "LedgerEvent_eventType_occurredAt_idx" ON "LedgerEvent"("eventType", "occurredAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
