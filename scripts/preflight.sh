#!/usr/bin/env bash
#
# preflight.sh — verify the app is actually ready before you deploy.
#
# Catches the common "deployed a broken site" mistakes by checking that:
#   1. .env.local exists and all six VITE_ vars are filled in.
#   2. The AWS resources those vars point at actually exist and are reachable
#      with your current credentials (Cognito pool, both maps, S3 bucket).
#   3. The production build succeeds locally.
#
# Read-only against AWS — it never creates or changes anything.
#
# Usage:
#   AWS_PROFILE=personal ./scripts/preflight.sh
#
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
PROFILE_ARG=""
[[ -n "${AWS_PROFILE:-}" ]] && PROFILE_ARG="--profile ${AWS_PROFILE}"

fail=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=1; }
head() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# --- 1. .env.local present and complete -------------------------------------
head "1. .env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  bad ".env.local not found — run ./setup-aws.sh first"
  echo; echo "Preflight FAILED."; exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
for var in VITE_AWS_REGION VITE_COGNITO_IDENTITY_POOL_ID VITE_MAP_NAME \
           VITE_VALIDATION_BUCKET VITE_JOBS_EXECUTION_ROLE_ARN; do
  if [[ -z "${!var:-}" ]]; then bad "$var is empty"; else ok "$var=${!var}"; fi
done
REGION="${VITE_AWS_REGION:-us-east-1}"
aws() { command aws --region "$REGION" $PROFILE_ARG "$@"; }

# --- 2. AWS resources reachable ---------------------------------------------
head "2. AWS resources (read-only)"
if ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)"; then
  ok "authenticated to account $ID"
else
  bad "AWS CLI not authenticated (run 'aws sso login' / 'aws configure')"
fi

if [[ -n "${VITE_COGNITO_IDENTITY_POOL_ID:-}" ]]; then
  if aws cognito-identity describe-identity-pool \
       --identity-pool-id "$VITE_COGNITO_IDENTITY_POOL_ID" >/dev/null 2>&1; then
    ok "Cognito identity pool exists"
  else
    bad "Cognito pool $VITE_COGNITO_IDENTITY_POOL_ID not found in $REGION"
  fi
fi

for m in "$VITE_MAP_NAME" "${VITE_MAP_NAME_DARK:-}"; do
  [[ -z "$m" ]] && continue
  if aws location describe-map --map-name "$m" >/dev/null 2>&1; then
    ok "map '$m' exists"
  else
    bad "map '$m' not found in $REGION"
  fi
done

if [[ -n "${VITE_VALIDATION_BUCKET:-}" ]]; then
  if aws s3api head-bucket --bucket "$VITE_VALIDATION_BUCKET" >/dev/null 2>&1; then
    ok "S3 bucket '$VITE_VALIDATION_BUCKET' reachable"
  else
    bad "S3 bucket '$VITE_VALIDATION_BUCKET' not reachable"
  fi
fi

# --- 3. Production build -----------------------------------------------------
head "3. Production build"
if (cd "$ROOT" && npm run build >/tmp/preflight-build.log 2>&1); then
  ok "npm run build succeeded"
else
  bad "npm run build failed — see /tmp/preflight-build.log"
fi

# --- Result ------------------------------------------------------------------
echo
if [[ "$fail" -eq 0 ]]; then
  printf '\033[1;32mPreflight PASSED — ready to deploy.\033[0m\n'
else
  printf '\033[1;31mPreflight FAILED — fix the ✗ items above before deploying.\033[0m\n'
  exit 1
fi
