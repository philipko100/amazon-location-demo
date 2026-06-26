/** Shows where the async pipeline is. No % is available — status + stage only. */
import type { PipelineStage } from "../../hooks/useBulkValidation";
import type { JobStatus } from "../../services/jobsApi";
import { Spinner } from "../shared/Spinner";

const STAGE_LABEL: Record<PipelineStage, string> = {
  idle: "",
  enriching: "Completing addresses with Autocomplete…",
  encoding: "Encoding addresses to Parquet…",
  uploading: "Uploading input to S3…",
  starting: "Starting validation job…",
  polling: "Validating addresses…",
  downloading: "Downloading results…",
  parsing: "Parsing results…",
  done: "Done",
  error: "",
};

export function ValidationProgress({
  stage,
  jobStatus,
  lastUpdated,
}: {
  stage: PipelineStage;
  jobStatus: JobStatus | null;
  lastUpdated: number | null;
}) {
  if (stage === "idle" || stage === "error") return null;
  const busy = stage !== "done";
  return (
    <div style={wrap}>
      {busy && <Spinner />}
      <span>{STAGE_LABEL[stage]}</span>
      {stage === "polling" && jobStatus && (
        <>
          <span style={badge}>{jobStatus}</span>
          {lastUpdated && (
            <span style={updatedStyle}>
              Updated at {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#444",
  margin: "8px 0",
};
const badge: React.CSSProperties = {
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: 12,
  padding: "2px 10px",
  fontSize: 11,
};
const updatedStyle: React.CSSProperties = {
  color: "#888",
  fontSize: 11,
};
