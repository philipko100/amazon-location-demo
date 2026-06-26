/**
 * Orchestrates the full bulk address-validation pipeline:
 *   addresses -> Parquet -> S3 upload -> StartJob -> poll -> download -> parse.
 *
 * Each stage updates `stage` so the UI can show where things are. There is no
 * progress percentage from the Jobs API, so we surface the status string only.
 */
import { useCallback, useState } from "react";
import type { AddressInput, EnrichedAddress, ValidationResult } from "../types";
import { addressesToParquet, parseResults } from "../utils/parquet";
import { uploadParquet, listKeys, downloadBytes } from "../services/s3Client";
import { enrichAddress } from "../services/placesClient";
import {
  startValidateAddressJob,
  pollUntilDone,
  type JobStatus,
} from "../services/jobsApi";
import { VALIDATION_BUCKET, JOBS_EXECUTION_ROLE_ARN } from "../config/aws";
import { MAX_ADDRESSES } from "../config/limits";

export type PipelineStage =
  | "idle"
  | "enriching"
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
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [enrichedAddresses, setEnrichedAddresses] = useState<EnrichedAddress[] | null>(null);
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (addresses: AddressInput[]) => {
    if (addresses.length === 0) {
      setError("Add at least one address.");
      return;
    }
    // Hard cap at the call site (defense in depth behind the UI caps).
    if (addresses.length > MAX_ADDRESSES) {
      setError(`This demo is limited to ${MAX_ADDRESSES} addresses per run.`);
      return;
    }
    setError(null);
    setResults(null);
    setJobStatus(null);
    setLastUpdated(null);
    setEnrichedAddresses(null);
    const key = newJobKey();
    // The Jobs API treats InputOptions.Location as a DIRECTORY/prefix and scans
    // it for Parquet files — not a single file path. So we put the file inside a
    // per-job folder and pass the folder URI as the input location.
    const inputPrefix = `input/${key}/`;
    const inputKey = `${inputPrefix}data.parquet`;
    const outputPrefix = `output/${key}/`;

    try {
      // Complete each address row-by-row via Autocomplete so the structured
      // components the Jobs schema requires (locality, region, postal code) are
      // populated. Sequential to keep request rate gentle for the demo.
      setStage("enriching");
      const enriched: EnrichedAddress[] = [];
      for (const addr of addresses) {
        try {
          enriched.push(await enrichAddress(addr));
        } catch {
          // A failed lookup just marks the row not-ready; it gets dropped below
          // rather than failing the whole job with an empty locality cell.
          enriched.push({ ...addr, ready: false });
        }
      }
      setEnrichedAddresses(enriched);

      // Parquet is columnar: a single empty AddressComponents_Locality fails the
      // entire job. Only send rows that came back with the required component.
      const ready = enriched.filter((a) => a.ready);
      if (ready.length === 0) {
        throw new Error(
          "Autocomplete couldn't resolve a city/locality for any address. " +
            "Try adding more detail (e.g. city and state).",
        );
      }

      setStage("encoding");
      const parquet = await addressesToParquet(ready);

      setStage("uploading");
      await uploadParquet(inputKey, parquet);
      const inputUri = `s3://${VALIDATION_BUCKET}/${inputPrefix}`;
      const outputUri = `s3://${VALIDATION_BUCKET}/${outputPrefix}`;

      setStage("starting");
      const started = await startValidateAddressJob(
        inputUri,
        outputUri,
        JOBS_EXECUTION_ROLE_ARN,
      );
      if (!started.JobId) throw new Error("StartJob did not return a JobId.");

      setStage("polling");
      const job = await pollUntilDone(started.JobId, (status) => {
        setJobStatus(status);
        setLastUpdated(Date.now());
      });
      if (job.Status !== "Completed") {
        throw new Error(
          `Job ${job.Status}` +
            (job.Error ? `: ${job.Error.Code} ${job.Error.Messages?.join("; ")}` : ""),
        );
      }

      setStage("downloading");
      // The service writes output as one or more Parquet files (possibly nested)
      // under the output prefix, alongside non-data markers like _SUCCESS. Take
      // every .parquet object and parse/concatenate them.
      const keys = await listKeys(outputPrefix);
      const parquetKeys = keys.filter((k) => k.toLowerCase().endsWith(".parquet"));
      if (parquetKeys.length === 0) {
        throw new Error("Job completed but produced no Parquet output files.");
      }

      setStage("parsing");
      const perFile = await Promise.all(
        parquetKeys.map(async (k) => parseResults(await downloadBytes(k))),
      );
      setResults(perFile.flat());
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }, []);

  return { stage, jobStatus, lastUpdated, enrichedAddresses, results, error, run };
}
