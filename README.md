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
V2 GeoRoutes (via the SDK), the Jobs API (via raw SigV4 `fetch`), and the S3
bucket the Jobs API uses for Parquet I/O.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values (see "AWS setup" below)
npm run dev                  # http://localhost:5173
```

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

## Deploy

Static build — host anywhere:

```bash
npm run build      # -> dist/
```

Recommended: Amplify Hosting (git-push) or S3 + CloudFront. Remember to add your
production origin to the S3 bucket CORS `AllowedOrigins`.
