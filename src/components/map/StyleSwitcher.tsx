/** OpenData style switcher — one button per configured V1 Map resource. */
import type { MapStyle } from "../../config/aws";

interface Props {
  styles: MapStyle[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function StyleSwitcher({ styles, activeKey, onChange }: Props) {
  if (styles.length < 2) return null; // nothing to switch between
  return (
    <div style={wrapStyle}>
      {styles.map((s) => (
        <button
          key={s.key}
          style={btnStyle(activeKey === s.key)}
          onClick={() => onChange(s.key)}
          type="button"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: 4,
  maxWidth: 280,
  background: "white",
  borderRadius: 6,
  padding: 4,
  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
};

const btnStyle = (active: boolean): React.CSSProperties => ({
  border: "none",
  borderRadius: 4,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
  background: active ? "#2563eb" : "transparent",
  color: active ? "#ffffff" : "#555",
  fontWeight: active ? 600 : 400,
});
