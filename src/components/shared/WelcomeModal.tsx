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
  borderRadius: 16,
  padding: "36px 32px 32px",
  maxWidth: 640,
  width: "100%",
  textAlign: "center",
  // Accent bar along the top + soft glow for a bit more pop.
  borderTop: "5px solid #2563eb",
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.45)",
  fontFamily: "system-ui, sans-serif",
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: "-0.01em",
  // Brand gradient text (navy -> blue).
  background: "linear-gradient(90deg, #232f3e 0%, #2563eb 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
};
const bodyStyle: React.CSSProperties = {
  margin: "0 auto 14px",
  maxWidth: 520,
  fontSize: 15,
  lineHeight: 1.6,
  color: "#374151",
};
const buttonStyle: React.CSSProperties = {
  marginTop: 12,
  border: "none",
  borderRadius: 10,
  padding: "12px 28px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  color: "#ffffff",
  background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
  boxShadow: "0 6px 18px rgba(37, 99, 235, 0.45)",
};
