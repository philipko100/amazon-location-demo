/**
 * Reports whether the viewport is at or below a mobile breakpoint, updating on
 * resize/rotation. Lets the app's inline styles adapt responsively (inline
 * styles can't use CSS @media queries).
 */
import { useEffect, useState } from "react";

export function useIsMobile(maxWidth = 640): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange(); // sync in case the breakpoint changed since first render
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
