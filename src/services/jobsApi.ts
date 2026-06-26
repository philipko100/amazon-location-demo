/**
 * Amazon Location Service Jobs API — bulk address validation (ValidateAddress).
 *
 * Uses the official AWS SDK v3 client (@aws-sdk/client-location), which exports
 * StartJobCommand / GetJobCommand / ListJobsCommand / CancelJobCommand. The SDK
 * resolves the endpoint and SigV4 signing automatically from the Cognito
 * credentials supplied via the auth helper — no manual request signing needed.
 *
 * We request the "Position" additional feature so validated addresses come back
 * with coordinates we can plot on the map.
 */
import {
  LocationClient,
  StartJobCommand,
  GetJobCommand,
  type StartJobCommandOutput,
  type GetJobCommandOutput,
  type JobStatus as SdkJobStatus,
} from "@aws-sdk/client-location";
import { getAuthHelper } from "./auth";
import { AWS_REGION } from "../config/aws";

export type JobStatus = SdkJobStatus; // "Pending" | "Running" | "Completed" | "Failed" | "Cancelling" | "Cancelled"

let clientPromise: Promise<LocationClient> | null = null;

function getLocationClient(): Promise<LocationClient> {
  if (!clientPromise) {
    clientPromise = getAuthHelper().then(
      (authHelper) =>
        new LocationClient({
          region: AWS_REGION,
          ...authHelper.getClientConfig(),
        }),
    );
  }
  return clientPromise;
}

/**
 * Start a ValidateAddress job over a Parquet file already staged in S3.
 * @param inputS3Uri  s3://bucket/input/<job>.parquet
 * @param outputS3Uri s3://bucket/output/<job>/ (prefix the service writes into)
 * @param executionRoleArn IAM role the service assumes for S3 access.
 */
export async function startValidateAddressJob(
  inputS3Uri: string,
  outputS3Uri: string,
  executionRoleArn: string,
): Promise<StartJobCommandOutput> {
  const client = await getLocationClient();
  return client.send(
    new StartJobCommand({
      Action: "ValidateAddress",
      ExecutionRoleArn: executionRoleArn,
      InputOptions: { Location: inputS3Uri, Format: "Parquet" },
      OutputOptions: { Location: outputS3Uri, Format: "Parquet" },
      // Ask for coordinates so results can be plotted on the map.
      ActionOptions: { ValidateAddress: { AdditionalFeatures: ["Position"] } },
    }),
  );
}

/** Poll a single job's status. */
export async function getJob(jobId: string): Promise<GetJobCommandOutput> {
  const client = await getLocationClient();
  return client.send(new GetJobCommand({ JobId: jobId }));
}

const TERMINAL: JobStatus[] = ["Completed", "Failed", "Cancelled"];

/**
 * Poll getJob with exponential backoff until the job reaches a terminal state.
 * The SDK also ships waitUntilJobCompleted, but we poll manually so we can push
 * each intermediate status to the UI (the waiter doesn't surface those).
 */
export async function pollUntilDone(
  jobId: string,
  onStatus?: (status: JobStatus) => void,
  opts: { initialDelayMs?: number; maxDelayMs?: number; timeoutMs?: number } = {},
): Promise<GetJobCommandOutput> {
  const initial = opts.initialDelayMs ?? 2000;
  const max = opts.maxDelayMs ?? 16000;
  const timeout = opts.timeoutMs ?? 10 * 60 * 1000;
  const start = performance.now();
  let delay = initial;

  for (;;) {
    const job = await getJob(jobId);
    if (job.Status) onStatus?.(job.Status);
    if (job.Status && TERMINAL.includes(job.Status)) return job;
    if (performance.now() - start > timeout) {
      throw new Error(`Job ${jobId} did not finish within ${timeout / 1000}s`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, max);
  }
}
