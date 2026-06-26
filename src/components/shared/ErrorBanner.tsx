export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={style} role="alert">
      ⚠️ {message}
    </div>
  );
}

const style: React.CSSProperties = {
  background: "#fde8e8",
  border: "1px solid #f5b5b5",
  color: "#a12020",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  margin: "8px 0",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
