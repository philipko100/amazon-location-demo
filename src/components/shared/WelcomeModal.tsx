/**
 * Welcome dialog shown on first load. Dismissible via the button, backdrop click,
 * or Escape. Purely presentational — App owns the open/closed state.
 */
import { useEffect } from "react";

export function WelcomeModal({ onClose }: { onClose: () => void }) {
  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={backdropStyle} onClick={onClose} role="presentation">
      <div
        style={dialogStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="welcome-title" style={titleStyle}>
          Welcome!
        </h2>
        <p style={bodyStyle}>
          This is a demo app showcasing the APIs and technologies I (Philip Ko)
          have built throughout my career. I have built APIs and services that
          brought in millions in annual revenue, and re-architected crucial
          systems to save millions in annual cost.
        </p>
        <p style={bodyStyle}>
          Here, you can try out some of the technologies I have built — an
          interactive map, a route distance/time matrix, and bulk address
          validation.
        </p>
        <button style={buttonStyle} onClick={onClose} type="button" autoFocus>
          Explore the demo
        </button>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};
const dialogStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 12,
  padding: "28px 28px 24px",
  maxWidth: 520,
  width: "100%",
  boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
  fontFamily: "system-ui, sans-serif",
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 24,
  color: "#232f3e",
};
const bodyStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 15,
  lineHeight: 1.55,
  color: "#374151",
};
const buttonStyle: React.CSSProperties = {
  marginTop: 4,
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  background: "#ff9900",
  color: "#232f3e",
};
