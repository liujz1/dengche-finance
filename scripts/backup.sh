#!/bin/bash
# dengche-finance 数据备份
set -euo pipefail
WORKDIR=$(cd "$(dirname "$0")/.." && pwd)
BACKUP_DIR="${BACKUP_DIR:-$WORKDIR/backups}"
TS=$(date +%Y%m%d-%H%M)
mkdir -p "$BACKUP_DIR"
# 备份 prod.db (或 dev.db, 取存在的)
DB_FILE=""
[ -f "$WORKDIR/prod.db" ] && DB_FILE="$WORKDIR/prod.db"
[ -f "$WORKDIR/dev.db" ] && [ -z "$DB_FILE" ] && DB_FILE="$WORKDIR/dev.db"
if [ -z "$DB_FILE" ]; then
  echo "ERROR: no DB file (prod.db / dev.db) found in $WORKDIR" >&2
  exit 1
fi
DB_NAME=$(basename "$DB_FILE")
cp "$DB_FILE" "$BACKUP_DIR/${DB_NAME%.db}-${TS}.db"
echo "DB backup: $BACKUP_DIR/${DB_NAME%.db}-${TS}.db"
# 打包 uploads/ (如果存在 + 有内容)
if [ -d "$WORKDIR/uploads" ] && [ -n "$(ls -A "$WORKDIR/uploads" 2>/dev/null)" ]; then
  tar czf "$BACKUP_DIR/uploads-${TS}.tar.gz" -C "$WORKDIR" uploads
  echo "uploads backup: $BACKUP_DIR/uploads-${TS}.tar.gz"
else
  echo "uploads/ 空或不存在, 跳过"
fi
# 留 7 天 — 删旧备份
find "$BACKUP_DIR" -name "*-*.db" -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -mtime +7 -delete 2>/dev/null || true
echo "✅ backup done"
