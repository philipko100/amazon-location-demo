import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ variant = "primary", style, ...rest }: Props) {
  const disabledStyle: React.CSSProperties = rest.disabled
    ? { opacity: 0.5, cursor: "not-allowed" }
    : {};
  return (
    <button {...rest} style={{ ...base, ...variants[variant], ...disabledStyle, ...style }} />
  );
}

const base: React.CSSProperties = {
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 500,
};

const variants: Record<string, React.CSSProperties> = {
  primary: { background: "#2563eb", color: "white" },
  secondary: { background: "#232f3e", color: "white" },
  ghost: { background: "transparent", color: "#232f3e", border: "1px solid #ccc" },
};
