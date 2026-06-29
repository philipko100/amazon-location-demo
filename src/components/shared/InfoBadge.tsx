/**
 * Small "ⓘ" badge that reveals a tooltip on hover/focus. At rest its ring is
 * static white; when `hint` is true (right after the welcome modal closes) a
 * rainbow ring spins a few times then fades to the white ring, and a bouncing
 * "hover me" prompt appears. The hint clears once the user hovers (onSeen).
 *
 * The tooltip text is split on "Impact:" so the impact line stands out in its
 * own paragraph.
 */
import { useEffect, useState } from "react";

interface Props {
  label: string; // accessible label
  text: string; // tooltip body (contains "... Impact: ...")
  hint: boolean; // show the spinning rainbow + bouncing prompt
  onSeen: () => void; // called when the tooltip is first revealed
  /** External open trigger — e.g. hovering the associated tab button. OR'd with
   *  the badge's own hover/focus so either surface reveals the tooltip. */
  open?: boolean;
}

function splitImpact(text: string): { body: string; impact: string | null } {
  const idx = text.indexOf("Impact:");
  if (idx === -1) return { body: text, impact: null };
  return { body: text.slice(0, idx).trim(), impact: text.slice(idx).trim() };
}

export function InfoBadge({ label, text, hint, onSeen, open: openExternal }: Props) {
  const [openSelf, setOpenSelf] = useState(false);
  const { body, impact } = splitImpact(text);
  const open = openSelf || Boolean(openExternal);

  // Once revealed (by either the badge or the tab), clear the attention hint.
  useEffect(() => {
    if (open && hint) onSeen();
  }, [open, hint, onSeen]);

  return (
    <span style={anchorStyle}>
      <button
        type="button"
        aria-label={label}
        className={hint ? "als-info-rainbow als-info-pulse" : undefined}
        style={badgeStyle}
        onMouseEnter={() => setOpenSelf(true)}
        onMouseLeave={() => setOpenSelf(false)}
        onFocus={() => setOpenSelf(true)}
        onBlur={() => setOpenSelf(false)}
      >
        <span style={glyphStyle}>i</span>
      </button>

      {hint && !open && (
        <span className="als-nudge-bounce" style={nudgeStyle}>
          Hover me! 👆
        </span>
      )}

      {open && (
        <span role="tooltip" style={tooltipStyle}>
          <span style={bodyTextStyle}>{body}</span>
          {impact && <span style={impactTextStyle}>{impact}</span>}
        </span>
      )}
    </span>
  );
}

const anchorStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
};

// Resting state: a static white ring (the padding background). When the
// .als-info-rainbow class is present, a spinning rainbow ::before sits on top
// and fades out, revealing this white ring underneath.
const badgeStyle: React.CSSProperties = {
  position: "relative",
  width: 20,
  height: 20,
  padding: 2,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  background: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const glyphStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1, // above the rainbow ::before
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
  top: "calc(100% + 8px)",
  // Anchor the prompt's right edge to the badge (extends leftward, finger on
  // the right), so it can't clip past the window's right edge for the rightmost
  // (Bulk Validation) badge.
  right: 0,
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 700,
  color: "#ffffff",
  background: "#1d4ed8",
  borderRadius: 8,
  padding: "4px 10px",
  boxShadow: "0 3px 10px rgba(29,78,216,0.5)",
  pointerEvents: "none",
  zIndex: 60,
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
  padding: "16px 12px 10px",
  borderRadius: 8,
  border: "1px solid #93c5fd",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  zIndex: 50,
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const bodyTextStyle: React.CSSProperties = {
  display: "block",
};

const impactTextStyle: React.CSSProperties = {
  display: "block",
  paddingTop: 8,
  borderTop: "1px solid rgba(255,255,255,0.15)",
  color: "#93c5fd",
  fontWeight: 700,
};
