/**
 * Orchestrates the full bulk address-validation pipeline:
 *   addresses -> Parquet -> S3 upload -> StartJob -> poll -> download -> parse.
 *
 * Each stage updates `stage` so the UI can show where things are. There is no
 * progress percentage from the Jobs API, so we surface the status string only.
 */
import { useCallback, useState } from "react";
import type { AddressInput, ValidationResult } from "../types";
import { addressesToParquet, parseResults } from "../utils/parquet";
import { uploadParquet, listKeys, downloadBytes } from "../services/s3Client";
import {
  startValidateAddressJob,
  pollUntilDone,
  type JobStatus,
} from "../services/jobsApi";
import { VALIDATION_BUCKET, JOBS_EXECUTION_ROLE_ARN } from "../config/aws";

export type PipelineStage =
  | "idle"
  | "encoding"
  | "uploading"
  | "starting"
  | "polling"
  | "downloading"
  | "parsing"
  | "done"
  | "error";

/**
 * Build a stable-ish job id without Date.now()/Math.random() at module load.
 * Uses crypto.randomUUID (available in modern browsers) at call time.
 */
function newJobKey(): string {
  return `job-${crypto.randomUUID()}`;
}

export function useBulkValidation() {
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (addresses: AddressInput[]) => {
    if (addresses.length === 0) {
      setError("Add at least one address.");
      return;
    }
    setError(null);
    setResults(null);
    setJobStatus(null);
    const key = newJobKey();
    const inputKey = `input/${key}.parquet`;
    const outputPrefix = `output/${key}/`;

    try {
      setStage("encoding");
      const parquet = await addressesToParquet(addresses);

      setStage("uploading");
      const inputUri = await uploadParquet(inputKey, parquet);
      const outputUri = `s3://${VALIDATION_BUCKET}/${outputPrefix}`;

      setStage("starting");
      const started = await startValidateAddressJob(
        inputUri,
        outputUri,
        JOBS_EXECUTION_ROLE_ARN,
      );
      if (!started.JobId) throw new Error("StartJob did not return a JobId.");

      setStage("polling");
      const job = await pollUntilDone(started.JobId, setJobStatus);
      if (job.Status !== "Completed") {
        throw new Error(
          `Job ${job.Status}` +
            (job.Error ? `: ${job.Error.Code} ${job.Error.Messages?.join("; ")}` : ""),
        );
      }

      setStage("downloading");
      // The service writes one or more files under the output prefix. Pick the
      // first .parquet object it produced.
      const keys = await listKeys(outputPrefix);
      const resultKey = keys.find((k) => k.endsWith(".parquet")) ?? keys[0];
      if (!resultKey) throw new Error("Job completed but produced no output files.");
      const bytes = await downloadBytes(resultKey);

      setStage("parsing");
      setResults(await parseResults(bytes));
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }, []);

  return { stage, jobStatus, results, error, run };
}
