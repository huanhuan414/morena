#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${ROOT_DIR}/server/src/storage/database/schema/migrations/2026-05-17_hotfix_content_notification.sql"

REMOTE_HOST="${REMOTE_HOST:-180.184.205.74}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-16033}"
DB_NAME="${DB_NAME:-mrl}"
DB_USER="${DB_USER:-mrl}"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "SQL not found: ${SQL_FILE}"
  exit 1
fi

REMOTE_SQL="/tmp/$(basename "${SQL_FILE}")"

echo "Uploading ${SQL_FILE} -> ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SQL}"
scp -P "${SSH_PORT}" "${SQL_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SQL}"

echo "Applying migration (MySQL will prompt for password)"
ssh -p "${SSH_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "cat '${REMOTE_SQL}' - <<'SQL' | mysql -h '${DB_HOST}' -P '${DB_PORT}' -u '${DB_USER}' -p '${DB_NAME}'
SHOW COLUMNS FROM content_generation_requests;
SHOW COLUMNS FROM notifications;
SQL"

echo "Done"
