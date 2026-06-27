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
  // Trim: env values pasted into a host's console (e.g. Amplify) often pick up a
  // stray leading/trailing space, which would silently corrupt a bucket name or
  // ARN (a trailing space on the bucket sent S3 PutObject to "<bucket> ",
  // surfacing as a confusing CORS error since S3 errors carry no CORS headers).
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return trimmed;
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

/**
 * The four OpenData map styles. Each is a separate V1 Map resource (the V1 Maps
 * API is resource-based: one style per resource). Each entry's `mapName` comes
 * from an env var; styles without a configured resource are filtered out so the
 * switcher only ever shows ones that actually exist.
 */
export interface MapStyle {
  key: string;
  label: string;
  mapName: string;
}

const mapEnv = (v: string | undefined) => (v ?? "").trim();
const ALL_MAP_STYLES: MapStyle[] = [
  { key: "standard-light", label: "Standard Light", mapName: mapEnv(import.meta.env.VITE_MAP_NAME) },
  { key: "standard-dark", label: "Standard Dark", mapName: mapEnv(import.meta.env.VITE_MAP_NAME_DARK) },
  { key: "viz-light", label: "Visualization Light", mapName: mapEnv(import.meta.env.VITE_MAP_NAME_VIZ_LIGHT) },
  { key: "viz-dark", label: "Visualization Dark", mapName: mapEnv(import.meta.env.VITE_MAP_NAME_VIZ_DARK) },
];

export const MAP_STYLES: MapStyle[] = ALL_MAP_STYLES.filter((s) => s.mapName.trim() !== "");

if (MAP_STYLES.length === 0) {
  throw new Error("No map styles configured. Set at least VITE_MAP_NAME in .env.local.");
}

/** Default style key: prefer Standard Dark, else the first available. */
export const DEFAULT_MAP_STYLE_KEY =
  MAP_STYLES.find((s) => s.key === "standard-dark")?.key ?? MAP_STYLES[0]!.key;

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
