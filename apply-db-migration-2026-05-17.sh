#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${ROOT_DIR}/server/src/storage/database/schema/migrations/2026-05-17_hotfix_content_notification.sql"

REMOTE_HOST="${REMOTE_HOST:-180.184.205.74}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_CONNECT_TIMEOUT="${SSH_CONNECT_TIMEOUT:-10}"
SSH_PASSWORD="${SSH_PASSWORD:-}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-16033}"
DB_NAME="${DB_NAME:-mrl}"
DB_USER="${DB_USER:-mrl}"
DB_PASSWORD="${DB_PASSWORD:-${MYSQL_PWD:-}}"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "SQL not found: ${SQL_FILE}"
  exit 1
fi

REMOTE_SQL="/tmp/$(basename "${SQL_FILE}")"

SSH_BASE_OPTS=(
  -o "StrictHostKeyChecking=${SSH_STRICT_HOST_KEY_CHECKING}"
  -o "ConnectTimeout=${SSH_CONNECT_TIMEOUT}"
)

if [[ -n "${SSH_KEY_PATH}" ]]; then
  SSH_BASE_OPTS+=(-i "${SSH_KEY_PATH}")
fi

run_ssh() {
  if [[ -n "${SSH_PASSWORD}" ]]; then
    if ! command -v sshpass >/dev/null 2>&1; then
      echo "SSH_PASSWORD is set but sshpass is not installed"
      exit 1
    fi
    sshpass -p "${SSH_PASSWORD}" ssh "${SSH_BASE_OPTS[@]}" -p "${SSH_PORT}" "$@"
    return
  fi

  ssh "${SSH_BASE_OPTS[@]}" -p "${SSH_PORT}" "$@"
}

run_scp() {
  if [[ -n "${SSH_PASSWORD}" ]]; then
    if ! command -v sshpass >/dev/null 2>&1; then
      echo "SSH_PASSWORD is set but sshpass is not installed"
      exit 1
    fi
    sshpass -p "${SSH_PASSWORD}" scp "${SSH_BASE_OPTS[@]}" -P "${SSH_PORT}" "$@"
    return
  fi

  scp "${SSH_BASE_OPTS[@]}" -P "${SSH_PORT}" "$@"
}

if [[ -n "${DB_PASSWORD}" ]]; then
  printf -v DB_PASSWORD_ESCAPED '%q' "${DB_PASSWORD}"
  MYSQL_PASSWORD_MODE="non-interactive"
  REMOTE_MYSQL_COMMAND="MYSQL_PWD=${DB_PASSWORD_ESCAPED} mysql -h '${DB_HOST}' -P '${DB_PORT}' -u '${DB_USER}' '${DB_NAME}'"
else
  MYSQL_PASSWORD_MODE="interactive"
  REMOTE_MYSQL_COMMAND="mysql -h '${DB_HOST}' -P '${DB_PORT}' -u '${DB_USER}' -p '${DB_NAME}'"
fi

echo "Uploading ${SQL_FILE} -> ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SQL}"
run_scp "${SQL_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SQL}"

echo "Applying migration (MySQL mode: ${MYSQL_PASSWORD_MODE})"
run_ssh "${REMOTE_USER}@${REMOTE_HOST}" "cat '${REMOTE_SQL}' - <<'SQL' | ${REMOTE_MYSQL_COMMAND}
SHOW COLUMNS FROM content_generation_requests;
SHOW COLUMNS FROM notifications;
SQL"

echo "Done"
