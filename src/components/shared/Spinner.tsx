/** Minimal CSS spinner (keyframes live in index.css). */
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="als-spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 9) }}
      aria-label="Loading"
      role="status"
    />
  );
}
