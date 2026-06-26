/**
 * Input caps for the public demo.
 *
 * These exist to apply friction and keep AWS cost bounded for an open,
 * unauthenticated portfolio site. IMPORTANT: because this is a static SPA using
 * anonymous Cognito credentials, these caps are CLIENT-SIDE friction only — they
 * are not a hard security/cost ceiling (a determined caller could hit the APIs
 * directly with the exposed temporary credentials). The real backstops are the
 * tightly-scoped IAM role and the AWS Budgets alarm created by setup-aws.sh.
 *
 * Tune freely — every limit the UI enforces is here.
 */

/** Max origins the route-matrix panel will accept. */
export const MAX_ORIGINS = 15;

/** Max destinations the route-matrix panel will accept. */
export const MAX_DESTINATIONS = 15;

/** Max addresses a single bulk-validation run will submit. */
export const MAX_ADDRESSES = 20;

/**
 * The actual CalculateRouteMatrix API maximums (shown in the UI to convey the
 * API's real capacity). These apply when a RoutingBoundary.Geometry is set,
 * which this app always does — so the bounded caps, not the lower "unbounded"
 * limits, are what's relevant. Source: AWS API reference, CalculateRouteMatrix.
 */
export const API_MAX_ORIGINS = 500;
export const API_MAX_DESTINATIONS = 500;
export const API_MAX_MATRIX = 160_000; // origins × destinations cap per request
