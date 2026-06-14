import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";
import pg from "pg";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DEFAULT_TIMEOUT_MS = 8000;

app.use(express.json({ limit: "1mb" }));

function firstEnv(names) {
  return names.map((name) => process.env[name]).find((value) => String(value || "").trim());
}

function readBooleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function withDeploymentEnv(body, mapping) {
  if (!body.useDeploymentEnv) return body;
  const resolved = { ...body };
  for (const [field, envNames] of Object.entries(mapping)) {
    resolved[field] = firstEnv(envNames) || resolved[field];
  }
  return resolved;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] || "").trim());
  if (missing.length) {
    const err = new Error(`缺少必要欄位：${missing.join(", ")}`);
    err.statusCode = 200;
    throw err;
  }
}

function withTimeout(work, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    work,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("連線逾時，請確認 Railway public URL、白名單或憑證。")), timeoutMs);
    })
  ]);
}

function redact(value = "") {
  return String(value)
    .replace(/:\/\/([^:/?#]+):([^@]+)@/g, "://$1:******@")
    .replace(/(password|secretAccessKey|accessKeyId)=([^&\s]+)/gi, "$1=******");
}

app.post("/api/test-connection", async (req, res) => {
  const started = Date.now();
  const body = req.body || {};
  const target = body.target;

  try {
    let details;

    if (target === "mongodb") {
      const config = withDeploymentEnv(body, {
        connectionString: ["MONGO_PUBLIC_URL", "MONGO_URL"],
        databaseName: ["MONGO_DATABASE", "MONGODB_DATABASE"],
        authSource: ["MONGO_AUTH_SOURCE", "MONGODB_AUTH_SOURCE"]
      });
      requireFields(config, ["connectionString"]);
      const client = new MongoClient(config.connectionString, {
        serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS
      });
      await withTimeout(client.connect());
      const pong = await client.db(config.databaseName || "admin").command({ ping: 1 });
      await client.close();
      details = {
        target: "MongoDB",
        source: config.useDeploymentEnv ? "deployment env" : "form",
        endpoint: redact(config.connectionString),
        database: config.databaseName || "admin",
        response: pong.ok === 1 ? "ping ok" : "ping returned"
      };
    } else if (target === "postgres") {
      const config = withDeploymentEnv(body, {
        connectionString: ["DATABASE_PUBLIC_URL", "DATABASE_URL", "POSTGRES_PUBLIC_URL", "POSTGRES_URL"],
        databaseName: ["PGDATABASE", "POSTGRES_DB"],
        ssl: ["POSTGRES_SSL"]
      });
      if (body.useDeploymentEnv && config.ssl === undefined) config.ssl = readBooleanEnv("DATABASE_SSL", true);
      config.ssl = coerceBoolean(config.ssl);
      requireFields(config, ["connectionString"]);
      const client = new pg.Client({
        connectionString: config.connectionString,
        connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined
      });
      await withTimeout(client.connect());
      const version = await client.query("select version()");
      await client.end();
      details = {
        target: "Postgres",
        source: config.useDeploymentEnv ? "deployment env" : "form",
        endpoint: redact(config.connectionString),
        database: config.databaseName || "由連線字串決定",
        response: version.rows?.[0]?.version?.split(" ").slice(0, 2).join(" ") || "query ok"
      };
    } else if (target === "mysql") {
      const config = withDeploymentEnv(body, {
        connectionString: ["MYSQL_PUBLIC_URL", "MYSQL_URL"],
        databaseName: ["MYSQL_DATABASE", "MYSQLDATABASE"],
        ssl: ["MYSQL_SSL"]
      });
      config.ssl = coerceBoolean(config.ssl);
      requireFields(config, ["connectionString"]);
      const connection = await withTimeout(mysql.createConnection({
        uri: config.connectionString,
        connectTimeout: DEFAULT_TIMEOUT_MS,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined
      }));
      const [rows] = await connection.query("select version() as version");
      await connection.end();
      details = {
        target: "MySQL",
        source: config.useDeploymentEnv ? "deployment env" : "form",
        endpoint: redact(config.connectionString),
        database: config.databaseName || "由連線字串決定",
        response: rows?.[0]?.version || "query ok"
      };
    } else if (target === "bucket") {
      const config = withDeploymentEnv(body, {
        endpoint: ["BUCKET_ENDPOINT", "S3_ENDPOINT", "AWS_ENDPOINT_URL"],
        region: ["BUCKET_REGION", "S3_REGION", "AWS_REGION"],
        bucketName: ["BUCKET_NAME", "S3_BUCKET", "AWS_BUCKET_NAME"],
        accessKeyId: ["BUCKET_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"],
        secretAccessKey: ["BUCKET_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]
      });
      requireFields(config, ["endpoint", "region", "bucketName", "accessKeyId", "secretAccessKey"]);
      const client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      });
      await withTimeout(client.send(new HeadBucketCommand({ Bucket: config.bucketName })));
      details = {
        target: "Bucket",
        source: config.useDeploymentEnv ? "deployment env" : "form",
        endpoint: config.endpoint,
        bucket: config.bucketName,
        region: config.region,
        response: "HeadBucket ok"
      };
    } else {
      const err = new Error("未知的連線目標。");
      err.statusCode = 200;
      throw err;
    }

    res.json({
      ok: true,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      details
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode >= 500 ? 500 : 200).json({
      ok: false,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      error: error.message || "連線測試失敗"
    });
  }
});

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`RailwayFengBroAI settings server listening on ${PORT}`);
});
