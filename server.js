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
      requireFields(body, ["connectionString"]);
      const client = new MongoClient(body.connectionString, {
        serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS
      });
      await withTimeout(client.connect());
      const pong = await client.db(body.databaseName || "admin").command({ ping: 1 });
      await client.close();
      details = {
        target: "MongoDB",
        endpoint: redact(body.connectionString),
        database: body.databaseName || "admin",
        response: pong.ok === 1 ? "ping ok" : "ping returned"
      };
    } else if (target === "postgres") {
      requireFields(body, ["connectionString"]);
      const client = new pg.Client({
        connectionString: body.connectionString,
        connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
        ssl: body.ssl ? { rejectUnauthorized: false } : undefined
      });
      await withTimeout(client.connect());
      const version = await client.query("select version()");
      await client.end();
      details = {
        target: "Postgres",
        endpoint: redact(body.connectionString),
        database: body.databaseName || "由連線字串決定",
        response: version.rows?.[0]?.version?.split(" ").slice(0, 2).join(" ") || "query ok"
      };
    } else if (target === "mysql") {
      requireFields(body, ["connectionString"]);
      const connection = await withTimeout(mysql.createConnection({
        uri: body.connectionString,
        connectTimeout: DEFAULT_TIMEOUT_MS,
        ssl: body.ssl ? { rejectUnauthorized: false } : undefined
      }));
      const [rows] = await connection.query("select version() as version");
      await connection.end();
      details = {
        target: "MySQL",
        endpoint: redact(body.connectionString),
        database: body.databaseName || "由連線字串決定",
        response: rows?.[0]?.version || "query ok"
      };
    } else if (target === "bucket") {
      requireFields(body, ["endpoint", "region", "bucketName", "accessKeyId", "secretAccessKey"]);
      const client = new S3Client({
        endpoint: body.endpoint,
        region: body.region,
        forcePathStyle: true,
        credentials: {
          accessKeyId: body.accessKeyId,
          secretAccessKey: body.secretAccessKey
        }
      });
      await withTimeout(client.send(new HeadBucketCommand({ Bucket: body.bucketName })));
      details = {
        target: "Bucket",
        endpoint: body.endpoint,
        bucket: body.bucketName,
        region: body.region,
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
