/**
 * Single Cognito-backed credential source for the entire app.
 *
 * Why Cognito and not an API key: we sign Jobs API + S3 requests with SigV4 from
 * the browser, which needs real temporary AWS credentials. API keys can't do
 * that (and don't cover Jobs/S3 at all). A Cognito Identity Pool with
 * unauthenticated access vends short-lived, auto-refreshing credentials scoped
 * to one IAM role — that single role's policy is the security boundary.
 *
 * The amazon-location-utilities-auth-helper gives us BOTH:
 *   - getMapAuthenticationOptions() -> { transformRequest } for MapLibre (V1 maps)
 *   - getLocationClientConfig()     -> { credentials } for AWS SDK v3 clients
 *                                       and for our raw SigV4 Jobs calls.
 */
import {
  withIdentityPoolId,
  type MapAuthHelper,
  type SDKAuthHelper,
} from "@aws/amazon-location-utilities-auth-helper";
import { COGNITO_IDENTITY_POOL_ID } from "../config/aws";

/** The helper returned by withIdentityPoolId provides both map + SDK auth. */
export type LocationAuthHelper = MapAuthHelper & SDKAuthHelper;

let authHelperPromise: Promise<LocationAuthHelper> | null = null;

/**
 * Returns a memoized auth helper. The first call provisions Cognito credentials;
 * subsequent calls reuse the same instance (which refreshes credentials on its
 * own before they expire).
 */
export function getAuthHelper(): Promise<LocationAuthHelper> {
  if (!authHelperPromise) {
    authHelperPromise = withIdentityPoolId(COGNITO_IDENTITY_POOL_ID);
  }
  return authHelperPromise;
}

/**
 * Resolve raw temporary credentials (accessKeyId/secretAccessKey/sessionToken)
 * for SigV4 signing in services/jobsApi.ts. getCredentials() returns the current
 * (already-refreshed) credentials synchronously after the helper is initialized.
 */
export async function resolveCredentials() {
  const authHelper = await getAuthHelper();
  return authHelper.getCredentials();
}
