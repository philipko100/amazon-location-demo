/**
 * Small "ⓘ" badge with a rainbow gradient outline that reveals a tooltip on
 * hover/focus. When `hint` is true it pulses + shows a "hover me" nudge to draw
 * attention (used right after the welcome modal closes); the nudge clears once
 * the user hovers (onSeen).
 */
import { useState } from "react";

interface Props {
  label: string; // accessible label
  text: string; // tooltip body
  hint: boolean; // show the attention pulse + nudge
  onSeen: () => void; // called when the user first hovers/focuses
}

export function InfoBadge({ label, text, hint, onSeen }: Props) {
  const [open, setOpen] = useState(false);

  const reveal = () => {
    setOpen(true);
    if (hint) onSeen();
  };
  const hide = () => setOpen(false);

  return (
    <span style={anchorStyle}>
      <button
        type="button"
        aria-label={label}
        className={hint ? "als-info-pulse" : undefined}
        style={badgeStyle}
        onMouseEnter={reveal}
        onMouseLeave={hide}
        onFocus={reveal}
        onBlur={hide}
      >
        <span style={glyphStyle}>i</span>
      </button>

      {hint && !open && <span style={nudgeStyle}>hover me</span>}

      {open && (
        <span role="tooltip" style={tooltipStyle}>
          {text}
        </span>
      )}
    </span>
  );
}

const anchorStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
};

// Rainbow outline via a conic-gradient background with a small padding ring;
// the inner glyph sits on a navy disc so the gradient reads as an outline.
const badgeStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  padding: 2,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  background:
    "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const glyphStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: "#232f3e",
  color: "white",
  fontSize: 12,
  fontWeight: 700,
  fontStyle: "italic",
  fontFamily: "Georgia, 'Times New Roman', serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const nudgeStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: "50%",
  transform: "translateX(-50%)",
  whiteSpace: "nowrap",
  fontSize: 10,
  fontWeight: 600,
  color: "#1d4ed8",
  background: "white",
  borderRadius: 6,
  padding: "1px 6px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
  pointerEvents: "none",
};

const tooltipStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: 320,
  maxWidth: "min(320px, 80vw)",
  background: "#232f3e",
  color: "#e5e7eb",
  fontSize: 12.5,
  lineHeight: 1.5,
  fontWeight: 400,
  padding: "10px 12px",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  zIndex: 50,
  textAlign: "left",
};
