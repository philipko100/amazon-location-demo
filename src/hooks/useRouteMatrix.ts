/**
 * CalculateRouteMatrix (V2 GeoRoutes) wrapper + React hook.
 *
 * Size caps (from the API docs):
 *   - With a RoutingBoundary.Geometry set: up to 500 origins x 500 destinations.
 *   - Unbounded (RoutingBoundary.Unbounded=true): only 15 origins x 100
 *     destinations, max 100 pairs total.
 * We always send a Geometry (an auto bounding box around all points) so the UI
 * is never silently capped at 100 — the demo targets ~10x10 comfortably.
 */
import { useCallback, useState } from "react";
import { CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";
import { getRoutesClient } from "../services/routesClient";
import type { LngLat, MatrixCell, NamedPoint, TravelMode } from "../types";

/** Bounding box [west, south, east, north] padded around all points. */
function boundingBox(points: LngLat[], padDegrees = 0.25): [number, number, number, number] {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [
    Math.min(...lngs) - padDegrees,
    Math.min(...lats) - padDegrees,
    Math.max(...lngs) + padDegrees,
    Math.max(...lats) + padDegrees,
  ];
}

export interface MatrixResult {
  origins: NamedPoint[];
  destinations: NamedPoint[];
  cells: MatrixCell[][]; // [originIndex][destIndex]
  errorCount: number;
}

export async function calculateMatrix(
  origins: NamedPoint[],
  destinations: NamedPoint[],
  travelMode: TravelMode,
): Promise<MatrixResult> {
  const client = await getRoutesClient();
  const all = [...origins, ...destinations].map((p) => p.position);

  const response = await client.send(
    new CalculateRouteMatrixCommand({
      Origins: origins.map((o) => ({ Position: o.position })),
      Destinations: destinations.map((d) => ({ Position: d.position })),
      TravelMode: travelMode,
      RoutingBoundary: { Geometry: { BoundingBox: boundingBox(all) } },
    }),
  );

  const matrix = response.RouteMatrix ?? [];
  const cells: MatrixCell[][] = origins.map((_, i) =>
    destinations.map((_, j) => {
      const entry = matrix[i]?.[j];
      return {
        distanceMeters: entry?.Distance ?? null,
        durationSeconds: entry?.Duration ?? null,
        error: entry?.Error ? String(entry.Error) : undefined,
      };
    }),
  );

  return {
    origins,
    destinations,
    cells,
    errorCount: response.ErrorCount ?? 0,
  };
}

export function useRouteMatrix() {
  const [result, setResult] = useState<MatrixResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (origins: NamedPoint[], destinations: NamedPoint[], mode: TravelMode) => {
      if (origins.length === 0 || destinations.length === 0) {
        setError("Add at least one origin and one destination.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setResult(await calculateMatrix(origins, destinations, mode));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { result, loading, error, run };
}
