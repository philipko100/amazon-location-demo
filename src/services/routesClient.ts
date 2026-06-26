/**
 * V2 GeoRoutes client for CalculateRouteMatrix.
 *
 * GeoRoutes is the "latest"-generation, resourceless Routes API: there is no
 * RouteCalculator resource to create. The endpoint is POST /v2/route-matrix on
 * routes.geo.<region>.amazonaws.com, and SigV4 signing happens automatically
 * via the Cognito credentials supplied through the auth helper's client config.
 */
import { GeoRoutesClient } from "@aws-sdk/client-geo-routes";
import { getAuthHelper } from "./auth";
import { AWS_REGION } from "../config/aws";

let clientPromise: Promise<GeoRoutesClient> | null = null;

export function getRoutesClient(): Promise<GeoRoutesClient> {
  if (!clientPromise) {
    clientPromise = getAuthHelper().then(
      (authHelper) =>
        new GeoRoutesClient({
          region: AWS_REGION,
          ...authHelper.getClientConfig(),
        }),
    );
  }
  return clientPromise;
}
