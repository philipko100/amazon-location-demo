/** A labeled list of points with "type lng,lat" and "pick on map" entry. */
import { useState } from "react";
import type { LngLat, NamedPoint } from "../../types";
import { Button } from "../shared/Button";

interface Props {
  title: string;
  color: string;
  points: NamedPoint[];
  max: number;
  onAdd: (position: LngLat, label?: string) => void;
  onRemove: (id: string) => void;
  onPickFromMap: () => void;
}

/**
 * Parse "lng, lat" (the order Amazon Location uses). Returns the point, or an
 * error message explaining what's wrong — including the common mistake of
 * entering coordinates in "lat, lng" order (latitude must be within ±90, so a
 * value like 122 in the second slot is rejected rather than crashing the map).
 */
function parseLngLat(text: string): { point: LngLat } | { error: string } {
  const parts = text.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    return { error: "Enter two numbers as: lng, lat" };
  }
  const [lng, lat] = parts as [number, number];
  if (lng < -180 || lng > 180) {
    return { error: "Longitude must be between -180 and 180" };
  }
  if (lat < -90 || lat > 90) {
    return { error: "Latitude must be between -90 and 90 (did you swap lng/lat?)" };
  }
  return { point: [lng, lat] };
}

export function PointList({ title, color, points, max, onAdd, onRemove, onPickFromMap }: Props) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const atCapacity = points.length >= max;

  function submit() {
    if (atCapacity) return;
    const parsed = parseLngLat(text);
    if ("error" in parsed) {
      setErr(parsed.error);
      return;
    }
    onAdd(parsed.point);
    setText("");
    setErr(null);
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3 style={{ fontSize: 14, margin: "0 0 6px", color }}>
        {title} ({points.length}/{max})
      </h3>
      <div style={{ display: "flex", gap: 4 }}>
        <input
          style={{ ...inputStyle, borderColor: err ? "#dc2626" : "#ccc" }}
          placeholder={atCapacity ? "limit reached" : "lng, lat"}
          value={text}
          disabled={atCapacity}
          onChange={(e) => {
            setText(e.target.value);
            if (err) setErr(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button
          variant="ghost"
          onClick={submit}
          disabled={atCapacity}
          style={{ padding: "4px 10px" }}
        >
          +
        </Button>
      </div>
      {err && <div style={errTextStyle}>{err}</div>}
      <Button
        variant="ghost"
        onClick={onPickFromMap}
        disabled={atCapacity}
        style={{ marginTop: 4, fontSize: 12, padding: "4px 8px", width: "100%" }}
      >
        📍 Pick on map
      </Button>
      <ul style={listStyle}>
        {points.map((p) => (
          <li key={p.id} style={liStyle}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.label}
            </span>
            <button onClick={() => onRemove(p.id)} style={removeBtn} aria-label="Remove">
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "5px 8px",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: 13,
};
const errTextStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: 11,
  marginTop: 4,
};
const listStyle: React.CSSProperties = { listStyle: "none", padding: 0, margin: "8px 0 0" };
const liStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  padding: "3px 0",
  borderBottom: "1px solid #eee",
  gap: 8,
};
const removeBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#999",
  fontSize: 16,
  lineHeight: 1,
};
