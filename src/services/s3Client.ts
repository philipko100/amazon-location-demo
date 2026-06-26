/**
 * S3 client used to stage the Jobs API's Parquet input and read back its
 * Parquet output. Uses the same Cognito credentials as everything else — the
 * Cognito role's policy grants s3:PutObject/GetObject on the validation bucket.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getAuthHelper } from "./auth";
import { AWS_REGION, VALIDATION_BUCKET } from "../config/aws";

let clientPromise: Promise<S3Client> | null = null;

function getS3Client(): Promise<S3Client> {
  if (!clientPromise) {
    clientPromise = getAuthHelper().then(
      (authHelper) =>
        new S3Client({
          region: AWS_REGION,
          ...authHelper.getClientConfig(),
        }),
    );
  }
  return clientPromise;
}

/** Upload Parquet bytes to s3://VALIDATION_BUCKET/<key>, returning the s3:// URI. */
export async function uploadParquet(key: string, body: Uint8Array): Promise<string> {
  const client = await getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: VALIDATION_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/vnd.apache.parquet",
    }),
  );
  return `s3://${VALIDATION_BUCKET}/${key}`;
}

/** List object keys under a prefix (used to discover the Jobs output file name). */
export async function listKeys(prefix: string): Promise<string[]> {
  const client = await getS3Client();
  const out = await client.send(
    new ListObjectsV2Command({ Bucket: VALIDATION_BUCKET, Prefix: prefix }),
  );
  return (out.Contents ?? []).map((o) => o.Key!).filter(Boolean);
}

/** Download an object as bytes. */
export async function downloadBytes(key: string): Promise<Uint8Array> {
  const client = await getS3Client();
  const out = await client.send(
    new GetObjectCommand({ Bucket: VALIDATION_BUCKET, Key: key }),
  );
  const bytes = await out.Body!.transformToByteArray();
  return bytes;
}
