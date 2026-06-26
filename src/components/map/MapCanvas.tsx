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

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerObjs = useRef<MlMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [activeMap, setActiveMap] = useState(MAP_NAME);
  const { markers, pickHandler, requestPick } = useAppState();

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
      map.on("load", () => !cancelled && setReady(true));
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

  // Swap styles when the user toggles light/dark (re-uses the same transformRequest).
  useEffect(() => {
    if (mapRef.current && ready) {
      mapRef.current.setStyle(mapStyleUrl(activeMap));
    }
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
      {pickHandler && <div style={pickBannerStyle}>Click the map to pick a location…</div>}
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
