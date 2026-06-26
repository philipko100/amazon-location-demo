/** Light/Dark OpenData style toggle (each style is a separate V1 Map resource). */

interface Props {
  light: string;
  dark: string;
  active: string;
  onChange: (mapName: string) => void;
}

export function StyleSwitcher({ light, dark, active, onChange }: Props) {
  return (
    <div style={wrapStyle}>
      <button
        style={btnStyle(active === light)}
        onClick={() => onChange(light)}
        type="button"
      >
        Light
      </button>
      <button
        style={btnStyle(active === dark)}
        onClick={() => onChange(dark)}
        type="button"
      >
        Dark
      </button>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  display: "flex",
  gap: 4,
  background: "white",
  borderRadius: 6,
  padding: 4,
  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
};

const btnStyle = (active: boolean): React.CSSProperties => ({
  border: "none",
  borderRadius: 4,
  padding: "4px 12px",
  cursor: "pointer",
  fontSize: 13,
  background: active ? "#ff9900" : "transparent",
  color: active ? "#232f3e" : "#555",
  fontWeight: active ? 600 : 400,
});
