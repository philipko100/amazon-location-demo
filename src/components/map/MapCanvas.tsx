/**
 * Interactive map — Feature 1.
 *
 * Renders the V1 OpenData map via MapLibre GL JS. The auth helper's
 * getMapAuthenticationOptions() returns a `transformRequest` that SigV4-signs
 * every style/tile/glyph/sprite request to maps.geo.<region>.amazonaws.com with
 * the Cognito credentials. We use raw maplibre-gl (no react wrapper) to avoid
 * peer-dependency drift between react-map-gl and maplibre-gl v5.
 */
import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap, type Marker as MlMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getAuthHelper } from "../../services/auth";
import { mapStyleUrl, MAP_NAME, MAP_NAME_DARK } from "../../config/aws";
import { useAppState } from "../../state/AppState";
import { StyleSwitcher } from "./StyleSwitcher";
import { Spinner } from "../shared/Spinner";

const LINE_SOURCE_ID = "route-lines";
const LINE_LAYER_ID = "route-lines-layer";
const LINE_ERROR_LAYER_ID = "route-lines-error-layer";

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerObjs = useRef<MlMarker[]>([]);
  const lineLabelObjs = useRef<MlMarker[]>([]);
  const appliedMap = useRef(MAP_NAME); // the style currently applied to the map
  const [ready, setReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0); // bumps when a new style finishes loading
  const [activeMap, setActiveMap] = useState(MAP_NAME);
  const { markers, routeLines, pickHandler, requestPick } = useAppState();

  // Initialize the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | undefined;

    (async () => {
      const authHelper = await getAuthHelper();
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyleUrl(activeMap),
        center: [-122.3321, 47.6062], // Seattle
        zoom: 10,
        ...authHelper.getMapAuthenticationOptions(), // injects transformRequest
      });
      map.addControl(new maplibregl.NavigationControl(), "top-left");
      map.on("load", () => {
        if (cancelled) return;
        setReady(true);
        setStyleEpoch((e) => e + 1);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // activeMap handled by a separate setStyle effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap styles when the user toggles light/dark (re-uses the same
  // transformRequest). setStyle wipes custom sources/layers, so we bump
  // styleEpoch once the new style is idle to trigger re-adding the route lines.
  // Skip when the style hasn't actually changed (e.g. the first run after the
  // map loads with the style it was constructed with).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || activeMap === appliedMap.current) return;
    appliedMap.current = activeMap;
    map.setStyle(mapStyleUrl(activeMap));
    map.once("idle", () => setStyleEpoch((e) => e + 1));
  }, [activeMap, ready]);

  // Route map clicks to a panel's pick handler when one is registered.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: maplibregl.MapMouseEvent) => {
      if (pickHandler) {
        pickHandler([e.lngLat.lng, e.lngLat.lat]);
        requestPick(null);
      }
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [pickHandler, requestPick]);

  // Let the user cancel pick mode with Escape (brings the panel back).
  useEffect(() => {
    if (!pickHandler) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestPick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickHandler, requestPick]);

  // Reflect shared markers onto the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markerObjs.current.forEach((m) => m.remove());
    markerObjs.current = markers.map((mk) => {
      const marker = new maplibregl.Marker({ color: mk.color })
        .setLngLat(mk.position)
        .addTo(map);
      if (mk.label) {
        marker.setPopup(new maplibregl.Popup({ offset: 24 }).setText(mk.label));
      }
      return marker;
    });
  }, [markers, ready]);

  // Draw origin→destination route lines + midpoint distance/time labels.
  // Re-runs on styleEpoch so the layers survive a light/dark style swap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // During a style swap the old source/layers are wiped and the new style may
    // still be loading; adding a source then would throw. Bail — the styleEpoch
    // bump on "idle" re-runs this effect once the style is ready.
    if (!map.isStyleLoaded()) return;

    const features = routeLines.map((line) => ({
      type: "Feature" as const,
      properties: { error: line.error ? 1 : 0 },
      geometry: {
        type: "LineString" as const,
        coordinates: [line.from, line.to],
      },
    }));
    const data = { type: "FeatureCollection" as const, features };

    // Source: create once, then update its data on subsequent runs.
    const existing = map.getSource(LINE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(LINE_SOURCE_ID, { type: "geojson", data });
    }

    // Insert the route lines beneath the base map's text labels (first symbol
    // layer) so road/place names stay readable on top of the lines.
    const firstSymbolId = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
    if (!map.getLayer(LINE_LAYER_ID)) {
      map.addLayer(
        {
          id: LINE_LAYER_ID,
          type: "line",
          source: LINE_SOURCE_ID,
          filter: ["==", ["get", "error"], 0],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#2563eb", "line-width": 2, "line-opacity": 0.7 },
        },
        firstSymbolId,
      );
    }
    if (!map.getLayer(LINE_ERROR_LAYER_ID)) {
      map.addLayer(
        {
          id: LINE_ERROR_LAYER_ID,
          type: "line",
          source: LINE_SOURCE_ID,
          filter: ["==", ["get", "error"], 1],
          paint: {
            "line-color": "#dc2626",
            "line-width": 1.5,
            "line-opacity": 0.6,
            "line-dasharray": [2, 2],
          },
        },
        firstSymbolId,
      );
    }

    // Midpoint labels as lightweight HTML markers (avoids depending on the map
    // style's glyph fonts, which a symbol text-field layer would require).
    lineLabelObjs.current.forEach((m) => m.remove());
    lineLabelObjs.current = routeLines
      .filter((line) => line.label)
      .map((line) => {
        const mid: [number, number] = [
          (line.from[0] + line.to[0]) / 2,
          (line.from[1] + line.to[1]) / 2,
        ];
        const el = document.createElement("div");
        el.textContent = line.label!;
        Object.assign(el.style, line.error ? lineLabelErrorCss : lineLabelCss);
        return new maplibregl.Marker({ element: el }).setLngLat(mid).addTo(map);
      });
  }, [routeLines, ready, styleEpoch]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {!ready && (
        <div style={overlayStyle}>
          <Spinner /> <span style={{ marginLeft: 8 }}>Loading map…</span>
        </div>
      )}
      {MAP_NAME_DARK && (
        <StyleSwitcher
          light={MAP_NAME}
          dark={MAP_NAME_DARK}
          active={activeMap}
          onChange={setActiveMap}
        />
      )}
      {pickHandler && (
        <div style={pickBannerStyle}>Click the map to pick a location · Esc to cancel</div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.7)",
};

const pickBannerStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  background: "#232f3e",
  color: "white",
  padding: "6px 14px",
  borderRadius: 6,
  fontSize: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
};

// Applied to DOM elements for route midpoint labels (not React styles).
const lineLabelCss: Partial<CSSStyleDeclaration> = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #2563eb",
  borderRadius: "10px",
  padding: "1px 6px",
  fontSize: "11px",
  fontFamily: "system-ui, sans-serif",
  color: "#1e3a8a",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
};
const lineLabelErrorCss: Partial<CSSStyleDeclaration> = {
  ...lineLabelCss,
  border: "1px solid #dc2626",
  color: "#991b1b",
};
