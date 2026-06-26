/**
 * Central place for all AWS-related configuration, read from Vite env vars.
 *
 * GENERATION NOTE: this app spans two Amazon Location API generations.
 *   - V1 ("previous"): the Map resource (GetMapTile / OpenData). Resource-based,
 *     served from maps.geo.<region>.amazonaws.com, requires a CreateMap resource.
 *   - V2 ("latest"): CalculateRouteMatrix (GeoRoutes) and the Jobs API
 *     (ValidateAddress). Resourceless; served from routes/geo endpoints.
 * A single Cognito Identity Pool authenticates all of them — see services/auth.ts.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const AWS_REGION = required(import.meta.env.VITE_AWS_REGION, "VITE_AWS_REGION");

export const COGNITO_IDENTITY_POOL_ID = required(
  import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
  "VITE_COGNITO_IDENTITY_POOL_ID",
);

/**
 * ARN of the Cognito unauthenticated IAM role. We assume it directly via the
 * STS classic flow (see services/auth.ts) instead of Cognito's enhanced flow,
 * because the enhanced flow attaches a scoped-down session policy that omits
 * iam:PassRole — which the Jobs StartJob call requires.
 */
export const COGNITO_UNAUTH_ROLE_ARN = required(
  import.meta.env.VITE_COGNITO_UNAUTH_ROLE_ARN,
  "VITE_COGNITO_UNAUTH_ROLE_ARN",
);

export const MAP_NAME = required(import.meta.env.VITE_MAP_NAME, "VITE_MAP_NAME");

/** Optional second (dark) Map resource. Empty string => no dark switcher. */
export const MAP_NAME_DARK = import.meta.env.VITE_MAP_NAME_DARK ?? "";

export const VALIDATION_BUCKET = required(
  import.meta.env.VITE_VALIDATION_BUCKET,
  "VITE_VALIDATION_BUCKET",
);

export const JOBS_EXECUTION_ROLE_ARN = required(
  import.meta.env.VITE_JOBS_EXECUTION_ROLE_ARN,
  "VITE_JOBS_EXECUTION_ROLE_ARN",
);

/**
 * V1 Maps style-descriptor URL that MapLibre loads. The descriptor itself
 * references the tile/glyph/sprite URLs; transformRequest (auth.ts) signs them.
 */
export function mapStyleUrl(mapName: string): string {
  return `https://maps.geo.${AWS_REGION}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor`;
}
