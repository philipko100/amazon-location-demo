/**
 * App shell. The map stays mounted at all times (tearing MapLibre down on every
 * tab switch is expensive and loses view state); the Route Matrix and Bulk
 * Validation panels slide in over the right side when their tab is active.
 */
import { useState } from "react";
import { MapCanvas } from "./components/map/MapCanvas";
import { RouteMatrixPanel } from "./components/route-matrix/RouteMatrixPanel";
import { BulkValidationPanel } from "./components/bulk-validation/BulkValidationPanel";
import { WelcomeModal } from "./components/shared/WelcomeModal";
import { InfoBadge } from "./components/shared/InfoBadge";
import { useAppState, type FeatureTab } from "./state/AppState";

const TABS: { id: FeatureTab; label: string; info: string }[] = [
  {
    id: "map",
    label: "Map",
    info:
      "I worked on our Map's service migration from a geospatial data ingestion cluster and distributed 1+ billion MVT tile replication architecture to a single, modular PMTiles-driven architecture for our OpenData GetMapTile technology in Amazon Location Service. Impact: saved $ millions in annual cost and 40+ hours in tile generation workflow runs.",
  },
  {
    id: "matrix",
    label: "Route Matrix",
    info:
      "I built our CalculateRouteMatrix API end-to-end that enables customers to compute 160,000 routes in under 30 seconds via a single, synchronous request to Amazon Location Service. Impact: $ millions in annual revenue.",
  },
  {
    id: "validation",
    label: "Bulk Validation",
    info:
      "I built our Jobs APIs and asynchronous distributed orchestration and workflow system that enables customers to verify, standardize, and enrich 100+ millions of their address records in under 24 hours using Amazon Location Service. Impact: $ millions in annual revenue.",
  },
];

export function App() {
  const { tab, setTab } = useAppState();
  const [showWelcome, setShowWelcome] = useState(true);
  // After the welcome modal closes, nudge the user to hover the info badges.
  // The hint stops once they hover any badge (handled in InfoBadge -> onSeen).
  const [hintBadges, setHintBadges] = useState(false);

  return (
    <div style={rootStyle}>
      {showWelcome && (
        <WelcomeModal
          onClose={() => {
            setShowWelcome(false);
            setHintBadges(true);
          }}
        />
      )}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/favicon.svg" width={24} height={24} alt="" />
          <strong>Philip Ko's Career Technologies Demo</strong>
        </div>
        <nav style={navStyle}>
          {TABS.map((t) => (
            <div key={t.id} style={tabGroupStyle}>
              <button
                onClick={() => setTab(t.id)}
                style={tabStyle(tab === t.id)}
                type="button"
              >
                {t.label}
              </button>
              <InfoBadge
                label={`About the ${t.label} service`}
                text={t.info}
                hint={hintBadges}
                onSeen={() => setHintBadges(false)}
              />
            </div>
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
  padding: "12px 18px",
  // Gradient bar with a thin blue underline for a bit more depth.
  background: "linear-gradient(90deg, #1b2532 0%, #232f3e 55%, #2d3e52 100%)",
  borderBottom: "3px solid #1d4ed8",
  color: "white",
  flexShrink: 0,
  boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
};
const navStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center" };
const tabGroupStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4 };
const tabStyle = (active: boolean): React.CSSProperties => ({
  border: "none",
  borderRadius: 8,
  padding: "7px 16px",
  cursor: "pointer",
  fontSize: 14,
  background: active ? "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)" : "rgba(255,255,255,0.06)",
  color: active ? "#ffffff" : "#cbd3dc",
  fontWeight: active ? 700 : 500,
  boxShadow: active ? "0 3px 10px rgba(29,78,216,0.5)" : "none",
  transition: "background 0.15s ease, color 0.15s ease",
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
