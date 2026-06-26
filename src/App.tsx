/**
 * App shell. The map stays mounted at all times (tearing MapLibre down on every
 * tab switch is expensive and loses view state); the Route Matrix and Bulk
 * Validation panels slide in over the right side when their tab is active.
 */
import { MapCanvas } from "./components/map/MapCanvas";
import { RouteMatrixPanel } from "./components/route-matrix/RouteMatrixPanel";
import { BulkValidationPanel } from "./components/bulk-validation/BulkValidationPanel";
import { useAppState, type FeatureTab } from "./state/AppState";

const TABS: { id: FeatureTab; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "matrix", label: "Route Matrix" },
  { id: "validation", label: "Bulk Validation" },
];

export function App() {
  const { tab, setTab } = useAppState();

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/favicon.svg" width={24} height={24} alt="" />
          <strong>Philip Ko's Geospatial Technologies Demo</strong>
        </div>
        <nav style={navStyle}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={tabStyle(tab === t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={mainStyle}>
        {/* Map is always present; it's the full canvas under the panels. */}
        <div style={mapWrapStyle}>
          <MapCanvas />
        </div>

        {/* Both panels stay mounted so their state (points, results, markers,
            lines) persists across tab switches; we just toggle visibility. */}
        <aside style={{ ...panelWrapStyle, ...(tab === "matrix" ? null : panelHiddenStyle) }}>
          <RouteMatrixPanel />
        </aside>
        <aside style={{ ...panelWrapStyle, ...(tab === "validation" ? null : panelHiddenStyle) }}>
          <BulkValidationPanel />
        </aside>
      </main>
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  background: "#232f3e",
  color: "white",
  flexShrink: 0,
};
const navStyle: React.CSSProperties = { display: "flex", gap: 4 };
const tabStyle = (active: boolean): React.CSSProperties => ({
  border: "none",
  borderRadius: 6,
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: 14,
  background: active ? "#ff9900" : "transparent",
  color: active ? "#232f3e" : "#cbd3dc",
  fontWeight: active ? 600 : 400,
});
const mainStyle: React.CSSProperties = { position: "relative", flex: 1, minHeight: 0 };
const mapWrapStyle: React.CSSProperties = { position: "absolute", inset: 0 };
const panelWrapStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(560px, 92vw)",
  background: "white",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
  zIndex: 10,
  transition: "transform 0.2s ease",
};
// Slide an inactive panel off the right edge (kept mounted to preserve state).
const panelHiddenStyle: React.CSSProperties = {
  transform: "translateX(100%)",
  pointerEvents: "none",
};
