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
  const { stage, jobStatus, results, error, run } = useBulkValidation();
  const { setMarkers, setTab } = useAppState();

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
    setMarkers(markers);
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

      <ValidationProgress stage={stage} jobStatus={jobStatus} />
      <ErrorBanner message={error} />

      {results && <ResultsTable results={results} />}
    </div>
  );
}

const panelStyle: React.CSSProperties = { padding: 16, overflowY: "auto", height: "100%" };
const hintStyle: React.CSSProperties = { fontSize: 12, color: "#666", margin: "4px 0 12px" };
