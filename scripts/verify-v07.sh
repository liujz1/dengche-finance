#!/bin/bash
# V0.7 Verify Pipeline — Codex wrapper 完成后跑此脚本
# 串行 verify: tsc → build → seed → dev server smoke test
# 任何失败 print error + exit code, dengche 介入修

set -u  # unset var = error
LEDGER_DIR=/Users/jiazhengliu/dengche/finance/ledger
LOG=/tmp/codex-logs/verify.log
: > "$LOG"

cd "$LEDGER_DIR" || exit 1

step() {
  echo ""
  echo "=========================================="
  echo "STEP: $*"
  echo "=========================================="
  echo "[$(date '+%H:%M:%S')] STEP: $*" >> "$LOG"
}

ok() { echo "✅ $*" | tee -a "$LOG"; }
fail() { echo "❌ $*" | tee -a "$LOG"; }

PASSED=0
FAILED=0

# 1. Wrapper DONE marker
step "1. Wrapper DONE marker"
if [ -f /tmp/codex-logs/DONE.marker ]; then
  cat /tmp/codex-logs/DONE.marker | tee -a "$LOG"
  ok "wrapper finished"
  PASSED=$((PASSED+1))
else
  fail "wrapper not finished (DONE.marker missing)"
  FAILED=$((FAILED+1))
fi

# 2. TypeScript check
step "2. TypeScript check (npx tsc --noEmit)"
if npx tsc --noEmit 2>&1 | tee -a "$LOG"; then
  ok "tsc passed"
  PASSED=$((PASSED+1))
else
  fail "tsc errors above"
  FAILED=$((FAILED+1))
fi

# 3. Lint
step "3. Lint (pnpm lint)"
if pnpm lint 2>&1 | tee -a "$LOG"; then
  ok "lint passed"
  PASSED=$((PASSED+1))
else
  fail "lint errors above"
  FAILED=$((FAILED+1))
fi

# 4. Build
step "4. Production build (pnpm build)"
if pnpm build 2>&1 | tee -a "$LOG"; then
  ok "build passed"
  PASSED=$((PASSED+1))
else
  fail "build errors above"
  FAILED=$((FAILED+1))
fi

# 5. DB Seed
step "5. DB Seed (pnpm db:seed)"
if pnpm db:seed 2>&1 | tee -a "$LOG"; then
  ok "seed passed"
  PASSED=$((PASSED+1))
else
  fail "seed errors above"
  FAILED=$((FAILED+1))
fi

# 6. DB content sanity
step "6. DB sanity check (count records)"
USER_COUNT=$(echo "SELECT COUNT(*) FROM User;" | sqlite3 dev.db 2>&1)
PROJECT_COUNT=$(echo "SELECT COUNT(*) FROM Project;" | sqlite3 dev.db 2>&1)
ENTRY_COUNT=$(echo "SELECT COUNT(*) FROM Entry;" | sqlite3 dev.db 2>&1)
echo "User: $USER_COUNT" | tee -a "$LOG"
echo "Project: $PROJECT_COUNT" | tee -a "$LOG"
echo "Entry: $ENTRY_COUNT" | tee -a "$LOG"
if [ "$USER_COUNT" -ge 3 ] && [ "$PROJECT_COUNT" -ge 2 ]; then
  ok "DB has expected seed data"
  PASSED=$((PASSED+1))
else
  fail "DB seed data missing"
  FAILED=$((FAILED+1))
fi

# 7. Dev server smoke test
step "7. Dev server smoke test"
pnpm dev > /tmp/codex-logs/dev-server.log 2>&1 &
DEV_PID=$!
echo "Dev server started, PID=$DEV_PID" | tee -a "$LOG"

# 等 server ready (最多 30 秒, 用 curl until)
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/login -o /dev/null 2>/dev/null; then
    ok "Dev server responding on /login"
    PASSED=$((PASSED+1))
    break
  fi
  if [ $i -eq 30 ]; then
    fail "Dev server not responding after 30s"
    FAILED=$((FAILED+1))
  fi
  sleep 1
done

# kill dev server
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null

# Summary
echo ""
echo "=========================================="
echo "VERIFY SUMMARY"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "=========================================="
{
  echo ""
  echo "VERIFY_FINISHED=$(date '+%Y-%m-%d %H:%M:%S')"
  echo "PASSED=$PASSED"
  echo "FAILED=$FAILED"
} >> "$LOG"

# Exit non-zero if any failed
if [ $FAILED -gt 0 ]; then
  exit 1
fi
exit 0
