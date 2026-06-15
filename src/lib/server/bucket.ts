import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const localDir = path.join(process.cwd(), ".data", "uploads");

function firstEnv(names: string[]) {
  return names.map((name) => process.env[name]).find((value) => String(value || "").trim());
}

function bucketConfig() {
  const bucket = firstEnv(["BUCKET_NAME", "S3_BUCKET", "AWS_BUCKET_NAME"]);
  return {
    bucket,
    endpoint: firstEnv(["BUCKET_ENDPOINT", "S3_ENDPOINT", "AWS_ENDPOINT_URL"]),
    region: firstEnv(["BUCKET_REGION", "S3_REGION", "AWS_REGION"]) || "auto",
    accessKeyId: firstEnv(["BUCKET_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"]),
    secretAccessKey: firstEnv(["BUCKET_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]),
    publicBase: firstEnv(["BUCKET_PUBLIC_BASE_URL", "S3_PUBLIC_BASE_URL"]),
    forcePathStyle: process.env.BUCKET_FORCE_PATH_STYLE !== "false" && process.env.S3_FORCE_PATH_STYLE !== "false",
  };
}

type UploadOptions = {
  module?: string;
  field?: string;
  requireBucket?: boolean;
};

function s3Client() {
  const config = bucketConfig();
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: config.accessKeyId
      ? {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey || "",
        }
      : undefined,
  });
}

function safePathPart(value?: string) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function uploadToBucket(file: File, options: UploadOptions = {}) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const prefix = ["fengbro", safePathPart(options.module), safePathPart(options.field), date].filter(Boolean).join("/");
  const key = `${prefix}/${crypto.randomUUID()}-${safeName}`;

  const config = bucketConfig();
  if (config.bucket) {
    const client = s3Client();
    const bucket = config.bucket;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: file.type }));
    const url = config.publicBase ? `${config.publicBase.replace(/\/$/, "")}/${key}` : `/api/files/${encodeURIComponent(key)}`;
    return {
      key,
      url,
      bucketUrl: url,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }

  if (options.requireBucket) {
    throw new Error("Bucket is not configured. Set BUCKET_NAME and Bucket credentials before uploading media files.");
  }

  await mkdir(path.join(localDir, path.dirname(key)), { recursive: true });
  await writeFile(path.join(localDir, key), bytes);
  const url = `/api/files/${encodeURIComponent(key)}`;
  return {
    key,
    url,
    bucketUrl: url,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

export async function readBucketFile(key: string) {
  const config = bucketConfig();
  if (config.bucket) {
    const client = s3Client();
    const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    const body = result.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return { bytes: Buffer.concat(chunks), type: result.ContentType || "application/octet-stream" };
  }

  return {
    bytes: await readFile(path.join(localDir, key)),
    type: "application/octet-stream",
  };
}
