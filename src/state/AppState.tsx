/**
 * Lightweight shared state so the map and the feature panels stay in sync:
 *  - which feature tab is active
 *  - the markers each feature wants drawn on the map
 *  - a "pick mode" so a panel can ask the user to click the map for a coordinate
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { LngLat } from "../types";

export type FeatureTab = "map" | "matrix" | "validation";

export interface MapMarker {
  id: string;
  position: LngLat;
  color: string;
  label?: string;
}

/** When set, the next map click is routed to this callback instead of normal handling. */
type PickHandler = ((position: LngLat) => void) | null;

interface AppStateValue {
  tab: FeatureTab;
  setTab: (t: FeatureTab) => void;
  markers: MapMarker[];
  setMarkers: (m: MapMarker[]) => void;
  pickHandler: PickHandler;
  requestPick: (handler: PickHandler) => void;
}

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<FeatureTab>("map");
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [pickHandler, setPickHandler] = useState<PickHandler>(null);

  // requestPick stores a function; wrap so setState doesn't treat it as an updater.
  const requestPick = (handler: PickHandler) => setPickHandler(() => handler);

  const value = useMemo<AppStateValue>(
    () => ({ tab, setTab, markers, setMarkers, pickHandler, requestPick }),
    [tab, markers, pickHandler],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used within AppStateProvider");
  return v;
}
