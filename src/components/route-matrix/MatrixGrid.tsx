/** Renders the route matrix: rows = origins, cols = destinations. */
import type { MatrixResult } from "../../hooks/useRouteMatrix";
import { formatDistance, formatDuration } from "../../utils/format";

interface Props {
  result: MatrixResult;
  unit: "km" | "mi";
}

export function MatrixGrid({ result, unit }: Props) {
  const { origins, destinations, cells } = result;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={cornerTh}>origin \ dest</th>
            {destinations.map((d) => (
              <th key={d.id} style={thStyle}>
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {origins.map((o, i) => (
            <tr key={o.id}>
              <th style={rowTh}>{o.label}</th>
              {destinations.map((d, j) => {
                const cell = cells[i]![j]!;
                if (cell.error) {
                  return (
                    <td key={d.id} style={errCell} title={cell.error}>
                      err
                    </td>
                  );
                }
                return (
                  <td key={d.id} style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>
                      {formatDistance(cell.distanceMeters, unit)}
                    </div>
                    <div style={{ color: "#666", fontSize: 11 }}>
                      {formatDuration(cell.durationSeconds)}
                    </div>
                  </td>
                );
              })}
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
  minWidth: "100%",
};
const thStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 10px",
  background: "#f5f5f5",
  maxWidth: 120,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const rowTh: React.CSSProperties = { ...thStyle, textAlign: "left", position: "sticky", left: 0 };
const cornerTh: React.CSSProperties = { ...thStyle, color: "#999", fontWeight: 400 };
const tdStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 10px",
  textAlign: "center",
};
const errCell: React.CSSProperties = {
  ...tdStyle,
  background: "#fde8e8",
  color: "#a12020",
  fontStyle: "italic",
};
