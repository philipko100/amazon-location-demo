/** Display formatters for the route matrix grid. */

export function formatDistance(meters: number | null, unit: "km" | "mi"): string {
  if (meters === null) return "—";
  if (unit === "km") return `${(meters / 1000).toFixed(1)} km`;
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
