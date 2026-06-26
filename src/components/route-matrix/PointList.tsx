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

/** Accepts "lng,lat" or "lat,lng"? We standardize on "lng,lat" to match the API. */
function parseLngLat(text: string): LngLat | null {
  const m = text.split(",").map((s) => Number(s.trim()));
  if (m.length !== 2 || m.some(Number.isNaN)) return null;
  return [m[0]!, m[1]!];
}

export function PointList({ title, color, points, max, onAdd, onRemove, onPickFromMap }: Props) {
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);
  const atCapacity = points.length >= max;

  function submit() {
    if (atCapacity) return;
    const pos = parseLngLat(text);
    if (!pos) {
      setErr(true);
      return;
    }
    onAdd(pos);
    setText("");
    setErr(false);
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
          onChange={(e) => setText(e.target.value)}
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
