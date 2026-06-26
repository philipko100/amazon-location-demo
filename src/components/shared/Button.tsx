import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ variant = "primary", style, ...rest }: Props) {
  return <button {...rest} style={{ ...base, ...variants[variant], ...style }} />;
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
  primary: { background: "#ff9900", color: "#232f3e" },
  secondary: { background: "#232f3e", color: "white" },
  ghost: { background: "transparent", color: "#232f3e", border: "1px solid #ccc" },
};
