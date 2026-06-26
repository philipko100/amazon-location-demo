/**
 * App-level error boundary. A thrown error during render or in an effect (e.g.
 * MapLibre rejecting an out-of-range coordinate) would otherwise unmount the
 * whole React tree and leave a blank page. This catches it and shows a
 * recoverable message instead.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; in production this could go to a logging service.
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div style={wrapStyle} role="alert">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Something went wrong</h2>
          <p style={{ margin: "0 0 12px", color: "#555", maxWidth: 480 }}>
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button style={btnStyle} onClick={this.reset} type="button">
            Dismiss and continue
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const wrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  padding: 24,
  textAlign: "center",
  fontFamily: "system-ui, sans-serif",
};
const btnStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 14,
  cursor: "pointer",
  background: "#ff9900",
  color: "#232f3e",
  fontWeight: 600,
};
