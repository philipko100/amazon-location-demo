/**
 * Lightweight shared state so the map and the feature panels stay in sync:
 *  - which feature tab is active
 *  - the markers each feature wants drawn on the map
 *  - a "pick mode" so a panel can ask the user to click the map for a coordinate
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LngLat } from "../types";
import { DEFAULT_MAP_STYLE_KEY } from "../config/aws";

export type FeatureTab = "map" | "matrix" | "validation";

/** Which feature owns a set of markers, so features don't clobber each other. */
export type MarkerSource = "matrix" | "validation";

export interface MapMarker {
  id: string;
  position: LngLat;
  color: string;
  label?: string;
}

/** A line connecting an origin to a destination, with an optional midpoint label. */
export interface RouteLine {
  id: string;
  from: LngLat;
  to: LngLat;
  label?: string; // e.g. "12.3 km · 15 min"
  error?: boolean; // true when the pair had no route
}

/**
 * A request for the next map click(s) to be routed to `onPick` instead of normal
 * handling. When `sticky` is true the request stays active after each click
 * (click-to-add mode) until explicitly cleared; otherwise it's one-shot. `kind`
 * lets the requesting panel know which list it's currently adding to.
 */
export interface PickRequest {
  onPick: (position: LngLat) => void;
  sticky?: boolean;
  kind?: "origin" | "dest";
}

interface AppStateValue {
  tab: FeatureTab;
  setTab: (t: FeatureTab) => void;
  /** All markers across features, flattened for the map to render. */
  markers: MapMarker[];
  /** Replace just one feature's markers; other features' markers are untouched. */
  setMarkersFor: (source: MarkerSource, markers: MapMarker[]) => void;
  routeLines: RouteLine[];
  setRouteLines: (l: RouteLine[]) => void;
  pick: PickRequest | null;
  requestPick: (req: PickRequest | null) => void;
  /** The active map style key (e.g. "standard-dark"); owned here so the feature
   *  panels can theme themselves to match the basemap. */
  mapStyleKey: string;
  setMapStyleKey: (key: string) => void;
  /** True when the active map style is a dark one. */
  isDark: boolean;
}

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<FeatureTab>("map");
  // Markers are kept per-feature so the route-matrix and validation features
  // can both show their own pins without overwriting each other.
  const [markersBySource, setMarkersBySource] = useState<Record<MarkerSource, MapMarker[]>>({
    matrix: [],
    validation: [],
  });
  const [routeLines, setRouteLines] = useState<RouteLine[]>([]);
  const [pick, setPick] = useState<PickRequest | null>(null);
  const [mapStyleKey, setMapStyleKey] = useState<string>(DEFAULT_MAP_STYLE_KEY);
  const isDark = mapStyleKey.includes("dark");

  const setMarkersFor = useCallback((source: MarkerSource, next: MapMarker[]) => {
    setMarkersBySource((prev) => ({ ...prev, [source]: next }));
  }, []);

  const markers = useMemo(
    () => [...markersBySource.matrix, ...markersBySource.validation],
    [markersBySource],
  );

  const requestPick = useCallback((req: PickRequest | null) => setPick(req), []);

  // Switching tabs cancels any in-progress map pick (the click-to-add mode
  // belongs to a specific panel). Panels stay mounted, so their points/markers
  // persist — only the transient pick mode is reset.
  const setTab = useCallback((t: FeatureTab) => {
    setPick(null);
    setTabState(t);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      tab,
      setTab,
      markers,
      setMarkersFor,
      routeLines,
      setRouteLines,
      pick,
      requestPick,
      mapStyleKey,
      setMapStyleKey,
      isDark,
    }),
    [tab, setTab, markers, setMarkersFor, routeLines, setRouteLines, pick, requestPick, mapStyleKey, isDark],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used within AppStateProvider");
  return v;
}
