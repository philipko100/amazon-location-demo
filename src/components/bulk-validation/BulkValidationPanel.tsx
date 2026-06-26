/**
 * Bulk Address Validation — Feature 3.
 *
 * Paste addresses (or a CSV), run the Jobs API ValidateAddress pipeline, and
 * view the standardized results + match confidence. Optionally plot matches.
 */
import { useState } from "react";
import { parseAddresses } from "../../utils/csv";
import { useBulkValidation } from "../../hooks/useBulkValidation";
import { MAX_ADDRESSES } from "../../config/limits";
import { useAppState, type MapMarker } from "../../state/AppState";
import { AddressUploader } from "./AddressUploader";
import { ValidationProgress } from "./ValidationProgress";
import { ResultsTable } from "./ResultsTable";
import { Button } from "../shared/Button";
import { ErrorBanner } from "../shared/ErrorBanner";

const MATCH_COLOR = "#16a34a";

export function BulkValidationPanel() {
  const [raw, setRaw] = useState("");
  const { stage, jobStatus, lastUpdated, enrichedAddresses, results, error, run } =
    useBulkValidation();
  const { setMarkersFor, setTab } = useAppState();

  const addresses = parseAddresses(raw);
  const busy = stage !== "idle" && stage !== "done" && stage !== "error";
  const overLimit = addresses.length > MAX_ADDRESSES;

  function plotOnMap() {
    if (!results) return;
    const markers: MapMarker[] = results
      .filter((r) => r.position)
      .map((r) => ({
        id: r.id,
        position: r.position!,
        color: MATCH_COLOR,
        label: r.outputLabel ?? r.inputLabel,
      }));
    setMarkersFor("validation", markers);
    setTab("map");
  }

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Bulk Address Validation</h2>
      <p style={hintStyle}>
        Paste one address per line, or a CSV with headers
        (line1, city, state, zip, country). Jobs API ValidateAddress supports US,
        CA, UK, and AU. Runs as an async S3-backed batch job. This demo is limited
        to {MAX_ADDRESSES} addresses per run.
      </p>

      <AddressUploader value={raw} onChange={setRaw} count={addresses.length} />

      {overLimit && (
        <p style={{ ...hintStyle, color: "#a12020" }}>
          {addresses.length} addresses entered — only the demo limit of{" "}
          {MAX_ADDRESSES} can be submitted. Remove {addresses.length - MAX_ADDRESSES}{" "}
          to continue.
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0" }}>
        <Button
          onClick={() => run(addresses)}
          disabled={busy || addresses.length === 0 || overLimit}
        >
          Validate {addresses.length > 0 ? `(${addresses.length})` : ""}
        </Button>
        {results && results.some((r) => r.position) && (
          <Button variant="secondary" onClick={plotOnMap}>
            📍 Plot matches on map
          </Button>
        )}
      </div>

      <ValidationProgress stage={stage} jobStatus={jobStatus} lastUpdated={lastUpdated} />

      {stage === "polling" && (
        <p style={waitNoteStyle}>
          This asynchronous validation service can take a few minutes to
          complete. In the meantime, checkout my other work, like my Route Matrix
          service!
        </p>
      )}

      <ErrorBanner message={error} />

      {enrichedAddresses && enrichedAddresses.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ ...hintStyle, margin: "0 0 6px", fontWeight: 600 }}>
            Addresses enriched before validating postal deliverability:
          </p>
          <ul style={enrichedListStyle}>
            {enrichedAddresses.map((a) => (
              <li key={a.id} style={enrichedItemStyle}>
                <span style={{ flex: 1 }}>
                  {a.enrichedLabel ??
                    [a.line1, a.locality, a.region, a.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                </span>
                {a.ready ? (
                  <span style={readyTag}>enriched</span>
                ) : (
                  <span style={skippedTag}>sent as typed</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {results && <ResultsTable results={results} />}
    </div>
  );
}

const panelStyle: React.CSSProperties = { padding: 16, overflowY: "auto", height: "100%" };
const hintStyle: React.CSSProperties = { fontSize: 12, color: "#666", margin: "4px 0 12px" };
const waitNoteStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#3730a3",
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  borderRadius: 6,
  padding: "8px 12px",
  margin: "8px 0",
};
const enrichedListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  border: "1px solid #eee",
  borderRadius: 6,
};
const enrichedItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  padding: "6px 10px",
  borderBottom: "1px solid #f0f0f0",
};
const readyTag: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 10,
  padding: "1px 8px",
  fontSize: 11,
  whiteSpace: "nowrap",
};
const skippedTag: React.CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
  borderRadius: 10,
  padding: "1px 8px",
  fontSize: 11,
  whiteSpace: "nowrap",
};
