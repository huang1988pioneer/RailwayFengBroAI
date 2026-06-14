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

export async function uploadToBucket(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;

  const config = bucketConfig();
  if (config.bucket) {
    const client = s3Client();
    const bucket = config.bucket;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: file.type }));
    return {
      key,
      url: config.publicBase ? `${config.publicBase.replace(/\/$/, "")}/${key}` : `/api/files/${encodeURIComponent(key)}`,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }

  await mkdir(path.join(localDir, path.dirname(key)), { recursive: true });
  await writeFile(path.join(localDir, key), bytes);
  return {
    key,
    url: `/api/files/${encodeURIComponent(key)}`,
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
