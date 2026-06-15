import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function firstEnv(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return "";
}

export function bucketConfig() {
  return {
    bucket: firstEnv(["BUCKET_NAME", "S3_BUCKET", "AWS_BUCKET_NAME"]),
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
    endpoint: config.endpoint || undefined,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function safePathPart(value = "") {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "");
}

function assertBucketConfig() {
  const config = bucketConfig();
  if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
    const error = new Error("Bucket is not configured. Set BUCKET_NAME, BUCKET_ACCESS_KEY_ID and BUCKET_SECRET_ACCESS_KEY.");
    error.statusCode = 500;
    throw error;
  }
  return config;
}

function createObjectKey(fileName, options = {}) {
  const safeName = safePathPart(fileName) || "upload";
  const date = new Date().toISOString().slice(0, 10);
  const prefix = ["fengbro", safePathPart(options.module), safePathPart(options.field), date].filter(Boolean).join("/");
  return `${prefix}/${crypto.randomUUID()}-${safeName}`;
}

function publicObjectUrl(config, key) {
  return config.publicBase ? `${config.publicBase.replace(/\/$/, "")}/${key}` : `/api/files/${encodeURIComponent(key)}`;
}

export async function createPresignedUpload(file, options = {}) {
  const config = assertBucketConfig();
  const key = createObjectKey(file.name, options);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: file.type || "application/octet-stream",
  });
  const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: 900 });
  const url = publicObjectUrl(config, key);
  return {
    key,
    uploadUrl,
    url,
    bucketUrl: url,
    name: file.name,
    type: file.type,
    size: file.size || 0,
  };
}

export async function uploadBufferToBucket(file, options = {}) {
  const config = assertBucketConfig();
  const key = createObjectKey(file.name, options);
  const client = s3Client();
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.type || "application/octet-stream",
  }));

  const url = publicObjectUrl(config, key);
  return {
    key,
    url,
    bucketUrl: url,
    name: file.name,
    type: file.type,
    size: file.buffer.length,
  };
}

export async function readBucketObject(key) {
  const config = bucketConfig();
  if (!config.bucket) {
    const error = new Error("Bucket is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const result = await s3Client().send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  return {
    body: result.Body,
    contentType: result.ContentType || "application/octet-stream",
  };
}
