/** Validation results table with confidence-colored rows. */
import type { MatchConfidence, ValidationResult } from "../../types";

const CONFIDENCE_BG: Record<MatchConfidence, string> = {
  High: "#dcfce7",
  MediumHigh: "#ecfccb",
  Medium: "#fef9c3",
  MediumLow: "#fed7aa",
  Low: "#fecaca",
};

export function ResultsTable({ results }: { results: ValidationResult[] }) {
  if (results.length === 0) return <p>No results.</p>;
  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Input</th>
            <th style={th}>Validated</th>
            <th style={th}>Granularity</th>
            <th style={th}>Confidence</th>
            <th style={th}>Score</th>
            <th style={th}>Coordinates</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.id}
              style={{ background: r.confidence ? CONFIDENCE_BG[r.confidence] : undefined }}
            >
              <td style={td}>{r.inputLabel}</td>
              <td style={td}>{r.outputLabel ?? "—"}</td>
              <td style={td}>{r.granularity ?? "—"}</td>
              <td style={td}>{r.confidence ?? "—"}</td>
              <td style={td}>
                {r.confidenceScore != null ? r.confidenceScore.toFixed(2) : "—"}
              </td>
              <td style={td}>
                {r.position ? `${r.position[1].toFixed(5)}, ${r.position[0].toFixed(5)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  fontSize: 12,
  width: "100%",
};
const th: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 10px",
  background: "#f5f5f5",
  textAlign: "left",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 10px" };
