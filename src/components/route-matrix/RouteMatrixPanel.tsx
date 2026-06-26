/**
 * Route Matrix calculator — Feature 2.
 *
 * Lets the user build a list of origins and destinations (typed lng,lat or
 * picked from the map), choose a travel mode, and compute the distance/time
 * matrix. Results render in a grid (rows = origins, cols = destinations).
 */
import { useEffect, useState } from "react";
import type { LngLat, NamedPoint, TravelMode } from "../../types";
import { useRouteMatrix } from "../../hooks/useRouteMatrix";
import { formatLngLat, formatDistance, formatDuration } from "../../utils/format";
import {
  MAX_ORIGINS,
  MAX_DESTINATIONS,
  API_MAX_ORIGINS,
  API_MAX_DESTINATIONS,
  API_MAX_MATRIX,
} from "../../config/limits";
import { useAppState, type MapMarker, type RouteLine } from "../../state/AppState";
import { PointList } from "./PointList";
import { MatrixGrid } from "./MatrixGrid";
import { Button } from "../shared/Button";
import { ErrorBanner } from "../shared/ErrorBanner";
import { Spinner } from "../shared/Spinner";

const ORIGIN_COLOR = "#2563eb";
const DEST_COLOR = "#dc2626";

export function RouteMatrixPanel() {
  const [origins, setOrigins] = useState<NamedPoint[]>([]);
  const [destinations, setDestinations] = useState<NamedPoint[]>([]);
  const [mode, setMode] = useState<TravelMode>("Car");
  const [unit, setUnit] = useState<"km" | "mi">("km");
  const { result, loading, error, run } = useRouteMatrix();
  const { setMarkers, setRouteLines, requestPick } = useAppState();

  // Keep the map's markers derived from the current points. Doing this in an
  // effect (rather than inside each mutation) means it always reflects the
  // latest state — no stale-closure risk from imperative sync calls.
  useEffect(() => {
    const markers: MapMarker[] = [
      ...origins.map((o) => ({ id: `o-${o.id}`, position: o.position, color: ORIGIN_COLOR, label: o.label })),
      ...destinations.map((d) => ({ id: `d-${d.id}`, position: d.position, color: DEST_COLOR, label: d.label })),
    ];
    setMarkers(markers);
  }, [origins, destinations, setMarkers]);

  // Draw a line for every origin→destination pair once a matrix is calculated,
  // each labeled with that route's distance · time. Cleared when inputs change
  // (result becomes null) so stale lines don't linger.
  useEffect(() => {
    if (!result) {
      setRouteLines([]);
      return;
    }
    const lines: RouteLine[] = [];
    result.origins.forEach((o, i) =>
      result.destinations.forEach((d, j) => {
        const cell = result.cells[i]?.[j];
        if (!cell) return;
        const label = cell.error
          ? "no route"
          : `${formatDistance(cell.distanceMeters, unit)} · ${formatDuration(cell.durationSeconds)}`;
        lines.push({
          id: `${o.id}-${d.id}`,
          from: o.position,
          to: d.position,
          label,
          error: Boolean(cell.error),
        });
      }),
    );
    setRouteLines(lines);
  }, [result, unit, setRouteLines]);

  // Clear route lines when this panel unmounts so they don't persist on the map.
  useEffect(() => () => setRouteLines([]), [setRouteLines]);

  function addPoint(kind: "origin" | "dest", position: LngLat, label?: string) {
    const point: NamedPoint = {
      id: crypto.randomUUID(),
      label: label ?? formatLngLat(position),
      position,
    };
    // Functional updates + cap enforcement, so adds from the async map-pick
    // callback always see the latest list (no stale closure).
    if (kind === "origin") {
      setOrigins((prev) => (prev.length >= MAX_ORIGINS ? prev : [...prev, point]));
    } else {
      setDestinations((prev) => (prev.length >= MAX_DESTINATIONS ? prev : [...prev, point]));
    }
  }

  function removePoint(kind: "origin" | "dest", id: string) {
    if (kind === "origin") {
      setOrigins((prev) => prev.filter((p) => p.id !== id));
    } else {
      setDestinations((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // The map is always mounted behind this panel, so its visible area is already
  // clickable — we just register the pick handler (no tab switch needed). The
  // MapCanvas shows a "Click the map to pick a location" banner while active.
  function pickFromMap(kind: "origin" | "dest") {
    requestPick((pos) => addPoint(kind, pos));
  }

  return (
    <div style={panelStyle}>
      <h2 style={h2Style}>Route Matrix</h2>
      <p style={hintStyle}>
        Add origins and destinations, then calculate distance &amp; time for every
        pair. This demo is limited to {MAX_ORIGINS} origins and{" "}
        {MAX_DESTINATIONS} destinations. The CalculateRouteMatrix API itself
        scales to {API_MAX_ORIGINS.toLocaleString()} origins ×{" "}
        {API_MAX_DESTINATIONS.toLocaleString()} destinations —{" "}
        {API_MAX_MATRIX.toLocaleString()} routes in a single request.
      </p>

      <div style={columnsStyle}>
        <PointList
          title="Origins"
          color={ORIGIN_COLOR}
          points={origins}
          max={MAX_ORIGINS}
          onAdd={(pos, label) => addPoint("origin", pos, label)}
          onRemove={(id) => removePoint("origin", id)}
          onPickFromMap={() => pickFromMap("origin")}
        />
        <PointList
          title="Destinations"
          color={DEST_COLOR}
          points={destinations}
          max={MAX_DESTINATIONS}
          onAdd={(pos, label) => addPoint("dest", pos, label)}
          onRemove={(id) => removePoint("dest", id)}
          onPickFromMap={() => pickFromMap("dest")}
        />
      </div>

      <div style={controlsStyle}>
        <label>
          Travel mode:{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as TravelMode)}>
            <option value="Car">Car</option>
            <option value="Pedestrian">Pedestrian</option>
            <option value="Scooter">Scooter</option>
            <option value="Truck">Truck</option>
          </select>
        </label>
        <label>
          Units:{" "}
          <select value={unit} onChange={(e) => setUnit(e.target.value as "km" | "mi")}>
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
        </label>
        <Button onClick={() => run(origins, destinations, mode)} disabled={loading}>
          {loading ? <Spinner /> : "Calculate"}
        </Button>
      </div>

      <ErrorBanner message={error} />

      {result && (
        <>
          {result.errorCount > 0 && (
            <p style={hintStyle}>
              {result.errorCount} cell(s) could not be routed (shown as “err”).
            </p>
          )}
          <MatrixGrid result={result} unit={unit} />
        </>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = { padding: 16, overflowY: "auto", height: "100%" };
const h2Style: React.CSSProperties = { margin: "0 0 4px", fontSize: 18 };
const hintStyle: React.CSSProperties = { fontSize: 12, color: "#666", margin: "4px 0 12px" };
const columnsStyle: React.CSSProperties = { display: "flex", gap: 12 };
const controlsStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  margin: "16px 0",
  flexWrap: "wrap",
  fontSize: 14,
};
