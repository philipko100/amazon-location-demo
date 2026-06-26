# Amazon Location Service Demo

A single-page React + Vite + TypeScript app demonstrating three Amazon Location
Service capabilities:

| Tab | API | Generation |
|---|---|---|
| **Map** | `GetMapTile` + OpenData style, rendered with MapLibre GL JS | **V1** ("previous", resource-based) |
| **Route Matrix** | `CalculateRouteMatrix` — distance/time for every origin×destination pair | **V2** GeoRoutes (resourceless) |
| **Bulk Validation** | Jobs API `ValidateAddress` — async batch address validation | **V2** Jobs |

The interesting bit is that these straddle **two API generations**. A single
**Amazon Cognito Identity Pool (unauthenticated)** is the one credential source
that authenticates all of them — it vends short-lived SigV4 credentials scoped
to one IAM role, which covers V1 map tiles (via MapLibre `transformRequest`),
V2 GeoRoutes and the Jobs API (both via the AWS SDK), and the S3 bucket the
Jobs API uses for Parquet I/O.

## Quick start

```bash
npm install
./setup-aws.sh               # provisions AWS + writes .env.local (see "One-command AWS setup")
npm run dev                  # http://localhost:5173
```

Prefer to wire it up by hand? `cp .env.example .env.local` and fill in the
values (see "AWS setup" below).

## Prerequisites

One-time setup before running `setup-aws.sh`:

1. **Personal AWS account** — create one at [aws.amazon.com](https://aws.amazon.com)
   if needed (requires a card; this demo runs near the free tier and the script
   adds a Budgets alarm as a safety net).
2. **CLI credentials** (in the Console, once):
   - IAM → Users → Create user (e.g. `cli-admin`) → attach **AdministratorAccess**
     (broad perms are needed to create IAM roles / Cognito / S3 / Budgets; scope
     down later). Do **not** create access keys on the root user.
   - On the user → Security credentials → Create access key → "Command Line
     Interface (CLI)". Copy the key id + secret.
3. **A named CLI profile** for this account:
   ```bash
   aws configure --profile personal
   # region: us-east-1   output: json
   ```
4. **Confirm the target account** before provisioning:
   ```bash
   aws sts get-caller-identity --profile personal   # verify it's YOUR personal account id
   ```
5. **Provision** (the script prompts to confirm the account first):
   ```bash
   AWS_PROFILE=personal ./setup-aws.sh
   ```

After it runs, **confirm the budget email** AWS sends to the alert address, or
the cost alarm won't fire.

## Tech stack

- **React 18 + Vite 6 + TypeScript** — SPA, fast HMR.
- **maplibre-gl v5** (raw, not react-map-gl) — avoids peer-dependency drift.
- **@aws/amazon-location-utilities-auth-helper** — one helper providing both the
  MapLibre `transformRequest` and the AWS SDK v3 client config from Cognito.
- **@aws-sdk/client-geo-routes** — `CalculateRouteMatrixCommand`.
- **@aws-sdk/client-location** — the official Amazon Location SDK; provides the
  Jobs commands (`StartJobCommand`, `GetJobCommand`, `ListJobsCommand`,
  `CancelJobCommand`) and a `waitUntilJobCompleted` waiter.
- **@aws-sdk/client-s3** — staging the Jobs input / reading the output in S3.
- **apache-arrow + parquet-wasm** — build/parse the Parquet files the Jobs API
  requires (lazy-loaded on first use).
- **papaparse** — CSV upload parsing.

## AWS setup

All resources MUST be in the same region (`VITE_AWS_REGION`).

### 1. Cognito Identity Pool (unauthenticated)

Create an identity pool with **unauthenticated access enabled**, and attach the
IAM policy below to its unauth role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "V1Maps",
      "Effect": "Allow",
      "Action": [
        "geo:GetMapTile",
        "geo:GetMapStyleDescriptor",
        "geo:GetMapGlyphs",
        "geo:GetMapSprites"
      ],
      "Resource": "arn:aws:geo:<region>:<account>:map/DemoOpenDataLight"
    },
    {
      "Sid": "V2RouteMatrix",
      "Effect": "Allow",
      "Action": "geo-routes:CalculateRouteMatrix",
      "Resource": "*"
    },
    {
      "Sid": "Jobs",
      "Effect": "Allow",
      "Action": ["geo:StartJob", "geo:GetJob", "geo:ListJobs"],
      "Resource": "*"
    },
    {
      "Sid": "S3ForJobs",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::<your-validation-bucket>",
        "arn:aws:s3:::<your-validation-bucket>/*"
      ]
    }
  ]
}
```

> ⚠️ The Jobs action prefix (`geo:` vs `geojobs:`) and the route-matrix resource
> ARN are **unconfirmed** — see "Things to verify" below. Start with the above and
> tighten once you've confirmed against a live call.

### 2. V1 Map resource(s)

```bash
aws location create-map \
  --map-name DemoOpenDataLight \
  --configuration Style=VectorOpenDataStandardLight \
  --region <region>

# OPTIONAL second resource for the light/dark switcher:
aws location create-map \
  --map-name DemoOpenDataDark \
  --configuration Style=VectorOpenDataStandardDark \
  --region <region>
```

### 3. S3 bucket for Jobs I/O

```bash
aws s3api create-bucket --bucket <your-validation-bucket> --region <region> \
  --create-bucket-configuration LocationConstraint=<region>

# Versioning is REQUIRED by the Jobs API:
aws s3api put-bucket-versioning --bucket <your-validation-bucket> \
  --versioning-configuration Status=Enabled

# CORS so the browser can PUT input and GET output:
aws s3api put-bucket-cors --bucket <your-validation-bucket> --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}'
```

### 4. Jobs execution role

A role the Jobs service assumes to read input / write output in S3. Trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "geo.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

Permissions policy: `s3:GetObject`, `s3:GetObjectVersion`, `s3:ListBucket`,
`s3:GetBucketVersioning` on the input prefix, and `s3:PutObject`,
`s3:AbortMultipartUpload` on the output prefix. Put its ARN in
`VITE_JOBS_EXECUTION_ROLE_ARN`.

## Things to verify on first run

These were inferred from the public docs but the docs don't pin them down. Each
is isolated to one place so they're easy to fix:

1. **Output Parquet column names** — `src/utils/parquet.ts` `parseResults()`.
   Inspect the actual output file's columns after the first completed job and
   align the `Output_*` field names.
2. **Output file naming** — `useBulkValidation.ts` picks the first `.parquet`
   object under the output prefix; confirm the service's naming convention.
3. **CalculateRouteMatrix distance units** — assumed meters in
   `utils/format.ts`; confirm against a known route.

> The Jobs signing/host/action-prefix unknowns from earlier drafts are gone: we
> use the official `@aws-sdk/client-location` Job commands, so the SDK resolves
> the endpoint, SigV4 signing, and action strings. The IAM actions are
> `geo:StartJob` / `geo:GetJob` / `geo:ListJobs` (the Amazon Location `geo:`
> namespace).

## Project layout

```
src/
├── config/aws.ts              # env vars + endpoint URLs
├── services/
│   ├── auth.ts                # Cognito auth helper (single credential source)
│   ├── routesClient.ts        # GeoRoutesClient
│   ├── s3Client.ts            # S3 upload/list/download
│   └── jobsApi.ts             # @aws-sdk/client-location StartJob/GetJob/poll
├── hooks/
│   ├── useRouteMatrix.ts      # CalculateRouteMatrix + boundary logic
│   └── useBulkValidation.ts   # Parquet→S3→StartJob→poll→download→parse
├── utils/{format,csv,parquet}.ts
├── state/AppState.tsx         # shared tab/markers/map-pick state
├── components/
│   ├── map/                   # MapCanvas, StyleSwitcher
│   ├── route-matrix/          # RouteMatrixPanel, PointList, MatrixGrid
│   ├── bulk-validation/       # BulkValidationPanel, AddressUploader, ...
│   └── shared/                # Button, Spinner, ErrorBanner
├── App.tsx                    # tab shell (map always mounted)
└── main.tsx
```

## One-command AWS setup

Instead of the manual steps above, `setup-aws.sh` provisions everything in
`us-east-1` and writes `.env.local` for you. It's idempotent (safe to re-run)
and performs no deletes.

```bash
aws sso login                 # or `aws configure` — must be authenticated first
./setup-aws.sh                # prompts to confirm the target account
npm run dev
```

It creates: the Cognito unauth pool + a least-privilege IAM role (with the
`iam:PassRole` needed to start Jobs), the Jobs execution role, both Map
resources, a versioned S3 bucket with CORS, and a **monthly AWS Budgets cost
alarm**. Override defaults with env vars, e.g. `BUDGET_AMOUNT=50
ALERT_EMAIL=you@example.com AWS_PROFILE=myprofile ./setup-aws.sh`.

## Cost & abuse guardrails (public demo)

This is a public, **unauthenticated** site — anyone with the URL can invoke the
AWS APIs anonymously. The guardrails:

- **Input caps** (`src/config/limits.ts`): max **15 origins**, **15
  destinations**, and **20 addresses** per run. These apply UI friction; note
  they are client-side, so they deter casual overuse but are not a hard ceiling.
- **Least-privilege IAM**: the unauth role can only call the four demo APIs on
  the specific map/bucket resources — nothing else in your account.
- **AWS Budgets alarm**: emails you at 80% of the monthly threshold.

For stronger protection later, consider an API key with HTTP-referer
restriction for the map, or moving to an authenticated Cognito pool.

## Deploy to AWS Amplify Hosting

`amplify.yml` (Node 20, `npm ci`, `npm run build`, artifacts in `dist/`) is
included. To deploy:

0. (Optional but recommended) Verify you're ready:
   `AWS_PROFILE=personal ./scripts/preflight.sh` — checks `.env.local` is
   complete, the AWS resources exist, and the build passes.
1. Push this repo to GitHub.
2. In the **Amplify console** → *Create new app* → *Host web app* → connect your
   GitHub repo and branch. Amplify auto-detects `amplify.yml`.
3. Add the env vars from `.env.local` under **App settings → Environment
   variables** (`VITE_AWS_REGION`, `VITE_COGNITO_IDENTITY_POOL_ID`,
   `VITE_MAP_NAME`, `VITE_MAP_NAME_DARK`, `VITE_VALIDATION_BUCKET`,
   `VITE_JOBS_EXECUTION_ROLE_ARN`). They're build-time values, baked into the
   bundle.
4. Add an SPA rewrite so any path serves the app: **App settings → Rewrites and
   redirects** → source `/<*>`, target `/index.html`, type `404-200`. (A
   single-page app has only one real HTML file; this hands all routes to it
   instead of returning 404.)
5. Deploy. Your site lands at `https://<branch>.<app-id>.amplifyapp.com`.
   To use a friendlier URL, rename the branch/app or attach a custom domain
   under **App settings → Custom domains** (see "Controlling the URL" below).

The S3 CORS rule already allows `https://*.amplifyapp.com`. If you attach a
**custom domain**, add it to the bucket's CORS `AllowedOrigins`:

```bash
aws s3api put-bucket-cors --bucket <your-bucket> --region us-east-1 \
  --cors-configuration '{"CORSRules":[{"AllowedOrigins":["https://yourdomain.com"],"AllowedMethods":["GET","PUT"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"]}]}'
```

> Heads-up: `npm run build` requires Node 18+. If your machine defaults to an
> older Node, use Node 20 for the build (Amplify already does via `amplify.yml`).

### Controlling the URL

The default URL is `https://<branch>.<app-id>.amplifyapp.com` — the `<app-id>`
is random and not editable, but you can improve the rest:

- **Branch subdomain** — the leading `<branch>` comes from your git branch name
  (e.g. `main.…`). Renaming the branch or app changes it, but it's still on the
  shared `amplifyapp.com` domain.
- **Custom domain (recommended for a real URL)** — to use something like
  `maps.yourdomain.com`, you need to own a domain (buy one in Route 53, ~\$12/yr
  for `.com`, or use a registrar you already have). Then in **Amplify → App
  settings → Custom domains → Add domain**, enter it and pick the subdomain.
  Amplify provisions a free TLS cert and wires DNS automatically if the domain
  is in Route 53 (otherwise it gives you CNAME records to add at your registrar).
  After it's live, add the new origin to the bucket CORS (command above).
