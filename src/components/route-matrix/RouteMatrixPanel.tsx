/**
 * Route Matrix calculator — Feature 2.
 *
 * Lets the user build a list of origins and destinations (typed lng,lat or
 * picked from the map), choose a travel mode, and compute the distance/time
 * matrix. Results render in a grid (rows = origins, cols = destinations).
 */
import { useState } from "react";
import type { LngLat, NamedPoint, TravelMode } from "../../types";
import { useRouteMatrix } from "../../hooks/useRouteMatrix";
import { useAppState, type MapMarker } from "../../state/AppState";
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
  const { setMarkers, requestPick, setTab } = useAppState();

  function syncMarkers(os: NamedPoint[], ds: NamedPoint[]) {
    const markers: MapMarker[] = [
      ...os.map((o) => ({ id: `o-${o.id}`, position: o.position, color: ORIGIN_COLOR, label: o.label })),
      ...ds.map((d) => ({ id: `d-${d.id}`, position: d.position, color: DEST_COLOR, label: d.label })),
    ];
    setMarkers(markers);
  }

  function addPoint(kind: "origin" | "dest", position: LngLat, label?: string) {
    const point: NamedPoint = {
      id: crypto.randomUUID(),
      label: label ?? `${position[1].toFixed(4)}, ${position[0].toFixed(4)}`,
      position,
    };
    if (kind === "origin") {
      const next = [...origins, point];
      setOrigins(next);
      syncMarkers(next, destinations);
    } else {
      const next = [...destinations, point];
      setDestinations(next);
      syncMarkers(origins, next);
    }
  }

  function removePoint(kind: "origin" | "dest", id: string) {
    if (kind === "origin") {
      const next = origins.filter((p) => p.id !== id);
      setOrigins(next);
      syncMarkers(next, destinations);
    } else {
      const next = destinations.filter((p) => p.id !== id);
      setDestinations(next);
      syncMarkers(origins, next);
    }
  }

  function pickFromMap(kind: "origin" | "dest") {
    setTab("map");
    requestPick((pos) => addPoint(kind, pos));
  }

  return (
    <div style={panelStyle}>
      <h2 style={h2Style}>Route Matrix</h2>
      <p style={hintStyle}>
        Add origins and destinations, then calculate distance &amp; time for every
        pair. Up to ~500×500 with a routing boundary; this demo targets a handful
        each.
      </p>

      <div style={columnsStyle}>
        <PointList
          title="Origins"
          color={ORIGIN_COLOR}
          points={origins}
          onAdd={(pos, label) => addPoint("origin", pos, label)}
          onRemove={(id) => removePoint("origin", id)}
          onPickFromMap={() => pickFromMap("origin")}
        />
        <PointList
          title="Destinations"
          color={DEST_COLOR}
          points={destinations}
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
