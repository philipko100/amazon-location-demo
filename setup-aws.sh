#!/usr/bin/env bash
#
# setup-aws.sh — provision the AWS backend for the Amazon Location demo and
# write the resulting identifiers into .env.local.
#
# Creates (all in one region):
#   - Cognito Identity Pool (UNAUTHENTICATED access) + its IAM role
#   - A least-privilege policy on that role (maps + route-matrix + jobs + s3 + passrole)
#   - A Jobs execution IAM role (assumed by geo.amazonaws.com) with S3 access
#   - Two V1 Map resources (light + dark OpenData styles)
#   - A versioned S3 bucket with CORS for the browser
#   - An AWS Budgets cost alarm (notifies you if spend crosses a threshold)
#
# The script is idempotent: re-running it reuses existing resources by name.
# It performs NO deletes. Review the values in the CONFIG block before running.
#
# Usage:
#   ./setup-aws.sh                      # uses the vars below / your default profile
#   AWS_PROFILE=myprofile ./setup-aws.sh
#
set -euo pipefail

# ----------------------------------------------------------------------------
# CONFIG — edit these, or override via environment variables.
# ----------------------------------------------------------------------------
REGION="${REGION:-us-east-1}"
PROFILE_ARG=""
if [[ -n "${AWS_PROFILE:-}" ]]; then PROFILE_ARG="--profile ${AWS_PROFILE}"; fi

# Resource names (safe to keep defaults). The map names MUST match .env.local.
POOL_NAME="${POOL_NAME:-AmazonLocationDemoPool}"
UNAUTH_ROLE_NAME="${UNAUTH_ROLE_NAME:-AmazonLocationDemoUnauthRole}"
JOBS_ROLE_NAME="${JOBS_ROLE_NAME:-AmazonLocationDemoJobsRole}"
MAP_NAME="${MAP_NAME:-DemoOpenDataLight}"
MAP_NAME_DARK="${MAP_NAME_DARK:-DemoOpenDataDark}"
MAP_NAME_VIZ_LIGHT="${MAP_NAME_VIZ_LIGHT:-DemoOpenDataVizLight}"
MAP_NAME_VIZ_DARK="${MAP_NAME_VIZ_DARK:-DemoOpenDataVizDark}"
# S3 bucket names are global; a random suffix is appended if not supplied.
BUCKET="${BUCKET:-}"

# Budget alarm
BUDGET_AMOUNT="${BUDGET_AMOUNT:-20}"          # USD per month
ALERT_EMAIL="${ALERT_EMAIL:-philip.ko.100@gmail.com}"

ENV_FILE="$(dirname "$0")/.env.local"

aws() { command aws --region "$REGION" $PROFILE_ARG "$@"; }
say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }

# ----------------------------------------------------------------------------
# 0. Preflight
# ----------------------------------------------------------------------------
say "Preflight: checking AWS credentials"
if ! ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)"; then
  echo "ERROR: AWS CLI is not authenticated (or token expired)."
  echo "Run e.g. 'aws sso login' or 'aws configure', then re-run this script."
  exit 1
fi
CALLER="$(aws sts get-caller-identity --query Arn --output text)"
echo "Account: $ACCOUNT_ID"
echo "Caller:  $CALLER"
echo "Region:  $REGION"
echo
read -r -p "Create demo resources in the account above? [y/N] " ok
[[ "$ok" == "y" || "$ok" == "Y" ]] || { echo "Aborted."; exit 1; }

if [[ -z "$BUCKET" ]]; then
  BUCKET="amazon-location-demo-${ACCOUNT_ID}-${REGION}"
fi
map_arn() { echo "arn:aws:geo:${REGION}:${ACCOUNT_ID}:map/$1"; }
MAP_ARNS="\"$(map_arn "$MAP_NAME")\",\"$(map_arn "$MAP_NAME_DARK")\",\"$(map_arn "$MAP_NAME_VIZ_LIGHT")\",\"$(map_arn "$MAP_NAME_VIZ_DARK")\""
JOBS_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${JOBS_ROLE_NAME}"

# ----------------------------------------------------------------------------
# 1. Map resources (V1 / OpenData)
# ----------------------------------------------------------------------------
say "Maps: creating V1 OpenData map resources"
for pair in "${MAP_NAME}:VectorOpenDataStandardLight" "${MAP_NAME_DARK}:VectorOpenDataStandardDark" "${MAP_NAME_VIZ_LIGHT}:VectorOpenDataVisualizationLight" "${MAP_NAME_VIZ_DARK}:VectorOpenDataVisualizationDark"; do
  name="${pair%%:*}"; style="${pair##*:}"
  if aws location describe-map --map-name "$name" >/dev/null 2>&1; then
    echo "  map '$name' already exists — skipping"
  else
    aws location create-map --map-name "$name" --configuration "Style=$style" >/dev/null
    echo "  created map '$name' ($style)"
  fi
done

# ----------------------------------------------------------------------------
# 2. S3 bucket (versioned) + CORS
# ----------------------------------------------------------------------------
say "S3: creating versioned bucket '$BUCKET'"
if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "  bucket already exists — skipping create"
else
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
  echo "  created bucket"
fi
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled
echo "  versioning enabled (required by the Jobs API)"
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}'
# CORS allows any origin: it is not the access control (SigV4 + the Cognito IAM
# role still gate every request) — it only governs which web origins the browser
# permits, so this avoids "Failed to fetch" on dev ports, LAN IPs (mobile), and
# the deployed domain alike. Tighten AllowedOrigins if you want to restrict it.
echo "  CORS set (all origins; SigV4/IAM is the real access control)"

# ----------------------------------------------------------------------------
# 3. Jobs execution role (assumed by geo.amazonaws.com)
# ----------------------------------------------------------------------------
say "IAM: Jobs execution role '$JOBS_ROLE_NAME'"
JOBS_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"geo.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if aws iam get-role --role-name "$JOBS_ROLE_NAME" >/dev/null 2>&1; then
  echo "  role exists — updating trust policy"
  aws iam update-assume-role-policy --role-name "$JOBS_ROLE_NAME" \
    --policy-document "$JOBS_TRUST" >/dev/null
else
  aws iam create-role --role-name "$JOBS_ROLE_NAME" \
    --assume-role-policy-document "$JOBS_TRUST" \
    --description "Amazon Location demo: role assumed by the Jobs service for S3 I/O" >/dev/null
  echo "  created role"
fi
JOBS_S3_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:GetObject","s3:GetObjectVersion","s3:ListBucket","s3:GetBucketVersioning"],
      "Resource": ["arn:aws:s3:::${BUCKET}","arn:aws:s3:::${BUCKET}/*"] },
    { "Effect": "Allow",
      "Action": ["s3:PutObject","s3:AbortMultipartUpload"],
      "Resource": ["arn:aws:s3:::${BUCKET}/*"] }
  ]
}
JSON
)
aws iam put-role-policy --role-name "$JOBS_ROLE_NAME" \
  --policy-name "JobsS3Access" --policy-document "$JOBS_S3_POLICY"
echo "  attached S3 access policy"

# ----------------------------------------------------------------------------
# 4. Cognito Identity Pool (unauthenticated)
# ----------------------------------------------------------------------------
say "Cognito: identity pool '$POOL_NAME'"
POOL_ID="$(aws cognito-identity list-identity-pools --max-results 60 \
  --query "IdentityPools[?IdentityPoolName=='${POOL_NAME}'].IdentityPoolId | [0]" \
  --output text)"
if [[ "$POOL_ID" == "None" || -z "$POOL_ID" ]]; then
  POOL_ID="$(aws cognito-identity create-identity-pool \
    --identity-pool-name "$POOL_NAME" \
    --allow-unauthenticated-identities \
    --query IdentityPoolId --output text)"
  echo "  created pool: $POOL_ID"
else
  echo "  pool exists: $POOL_ID"
fi

# ----------------------------------------------------------------------------
# 5. Unauth IAM role (assumed by anonymous browser users via the pool)
# ----------------------------------------------------------------------------
say "IAM: Cognito unauth role '$UNAUTH_ROLE_NAME'"
UNAUTH_TRUST=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Federated": "cognito-identity.amazonaws.com"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {"cognito-identity.amazonaws.com:aud": "${POOL_ID}"},
      "ForAnyValue:StringLike": {"cognito-identity.amazonaws.com:amr": "unauthenticated"}
    }
  }]
}
JSON
)
if aws iam get-role --role-name "$UNAUTH_ROLE_NAME" >/dev/null 2>&1; then
  echo "  role exists — updating trust policy"
  aws iam update-assume-role-policy --role-name "$UNAUTH_ROLE_NAME" \
    --policy-document "$UNAUTH_TRUST" >/dev/null
else
  aws iam create-role --role-name "$UNAUTH_ROLE_NAME" \
    --assume-role-policy-document "$UNAUTH_TRUST" \
    --description "Amazon Location demo: anonymous browser role (least privilege)" >/dev/null
  echo "  created role"
fi
UNAUTH_ROLE_ARN="$(aws iam get-role --role-name "$UNAUTH_ROLE_NAME" --query Role.Arn --output text)"

UNAUTH_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "V1Maps", "Effect": "Allow",
      "Action": ["geo:GetMapTile","geo:GetMapStyleDescriptor","geo:GetMapGlyphs","geo:GetMapSprites"],
      "Resource": [${MAP_ARNS}] },
    { "Sid": "V2RouteMatrix", "Effect": "Allow",
      "Action": "geo-routes:CalculateRouteMatrix", "Resource": "*" },
    { "Sid": "V2Places", "Effect": "Allow",
      "Action": "geo-places:Autocomplete", "Resource": "*" },
    { "Sid": "Jobs", "Effect": "Allow",
      "Action": ["geo:StartJob","geo:GetJob","geo:ListJobs"], "Resource": "*" },
    { "Sid": "PassJobsRole", "Effect": "Allow",
      "Action": "iam:PassRole", "Resource": "${JOBS_ROLE_ARN}" },
    { "Sid": "S3ForJobs", "Effect": "Allow",
      "Action": ["s3:PutObject","s3:GetObject","s3:ListBucket"],
      "Resource": ["arn:aws:s3:::${BUCKET}","arn:aws:s3:::${BUCKET}/*"] }
  ]
}
JSON
)
aws iam put-role-policy --role-name "$UNAUTH_ROLE_NAME" \
  --policy-name "AmazonLocationDemoAccess" --policy-document "$UNAUTH_POLICY"
echo "  attached least-privilege access policy (incl. iam:PassRole for the Jobs role)"

# Wire the role to the pool's unauthenticated identities.
aws cognito-identity set-identity-pool-roles \
  --identity-pool-id "$POOL_ID" \
  --roles "unauthenticated=${UNAUTH_ROLE_ARN}"
echo "  bound unauth role to identity pool"

# ----------------------------------------------------------------------------
# 6. Budget cost alarm
# ----------------------------------------------------------------------------
say "Budgets: \$${BUDGET_AMOUNT}/mo cost alarm -> ${ALERT_EMAIL}"
BUDGET_JSON=$(cat <<JSON
{"BudgetName":"AmazonLocationDemoBudget","BudgetLimit":{"Amount":"${BUDGET_AMOUNT}","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}
JSON
)
NOTIF_JSON=$(cat <<JSON
[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"${ALERT_EMAIL}"}]}]
JSON
)
if aws budgets describe-budget --account-id "$ACCOUNT_ID" \
     --budget-name "AmazonLocationDemoBudget" >/dev/null 2>&1; then
  echo "  budget already exists — skipping"
else
  if aws budgets create-budget --account-id "$ACCOUNT_ID" \
       --budget "$BUDGET_JSON" --notifications-with-subscribers "$NOTIF_JSON" 2>/dev/null; then
    echo "  created budget (confirm the email subscription in your inbox)"
  else
    echo "  WARN: could not create budget (needs budgets:* perms). Set one up manually."
  fi
fi

# ----------------------------------------------------------------------------
# 7. Write .env.local
# ----------------------------------------------------------------------------
say "Writing $ENV_FILE"
cat > "$ENV_FILE" <<ENV
# Generated by setup-aws.sh on region ${REGION}. These are non-secret identifiers
# (the IAM role policy is the security boundary), safe to expose in the browser.
VITE_AWS_REGION=${REGION}
VITE_COGNITO_IDENTITY_POOL_ID=${POOL_ID}
VITE_COGNITO_UNAUTH_ROLE_ARN=${UNAUTH_ROLE_ARN}
VITE_MAP_NAME=${MAP_NAME}
VITE_MAP_NAME_DARK=${MAP_NAME_DARK}
VITE_MAP_NAME_VIZ_LIGHT=${MAP_NAME_VIZ_LIGHT}
VITE_MAP_NAME_VIZ_DARK=${MAP_NAME_VIZ_DARK}
VITE_VALIDATION_BUCKET=${BUCKET}
VITE_JOBS_EXECUTION_ROLE_ARN=${JOBS_ROLE_ARN}
ENV
echo "  done"

say "Setup complete"
cat <<SUMMARY
  Region:            ${REGION}
  Identity Pool:     ${POOL_ID}
  Unauth role:       ${UNAUTH_ROLE_ARN}
  Jobs role:         ${JOBS_ROLE_ARN}
  Maps:              ${MAP_NAME}, ${MAP_NAME_DARK}, ${MAP_NAME_VIZ_LIGHT}, ${MAP_NAME_VIZ_DARK}
  S3 bucket:         ${BUCKET}
  Budget:            \$${BUDGET_AMOUNT}/mo -> ${ALERT_EMAIL}

  Next:
    npm run dev           # run locally (uses .env.local above)
    # IAM changes can take a few seconds to propagate before the first call works.
SUMMARY
