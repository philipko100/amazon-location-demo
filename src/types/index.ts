/** Shared domain types across the three features. */

/** Longitude/latitude pair, in the [lng, lat] order Amazon Location expects. */
export type LngLat = [number, number];

/** A named point used as a route-matrix origin or destination. */
export interface NamedPoint {
  id: string;
  label: string;
  position: LngLat;
}

export type TravelMode = "Car" | "Pedestrian" | "Scooter" | "Truck";

/** One cell of the route matrix result, mapped from a RouteMatrixEntry. */
export interface MatrixCell {
  /** Distance in meters (null when the cell errored). */
  distanceMeters: number | null;
  /** Duration in seconds (null when the cell errored). */
  durationSeconds: number | null;
  /** Error enum from the API, e.g. "NoMatch" | "NoRoute" | "OutOfBounds". */
  error?: string;
}

/** One row of address-validation input. */
export interface AddressInput {
  id: string;
  line1: string;
  locality?: string; // city
  region?: string; // state/province
  postalCode?: string;
  country?: string; // ISO; Jobs supports US, CA, GB/UK, AU
}

/** An AddressInput after the Autocomplete enrichment pass. */
export interface EnrichedAddress extends AddressInput {
  /** The full standardized label Autocomplete returned (for display). */
  enrichedLabel?: string;
  /** True if enrichment produced the components the Jobs schema requires. */
  ready: boolean;
}

export type MatchConfidence = "High" | "MediumHigh" | "Medium" | "MediumLow" | "Low";

/** One row of address-validation output, parsed from the result Parquet. */
export interface ValidationResult {
  id: string;
  inputLabel: string;
  outputLabel?: string;
  granularity?: string; // Premise | Street | LocalityAndPostalCode | Locality
  confidence?: MatchConfidence;
  confidenceScore?: number; // 0..1
  position?: LngLat; // present when the result carries coordinates
}
