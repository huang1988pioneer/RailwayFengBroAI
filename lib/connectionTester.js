import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";
import pg from "pg";

const DEFAULT_TIMEOUT_MS = 8000;

const ENV_MAPPINGS = {
  mongodb: {
    connectionString: ["MONGO_PUBLIC_URL", "MONGO_URL"],
    databaseName: ["MONGO_DATABASE", "MONGODB_DATABASE"],
    authSource: ["MONGO_AUTH_SOURCE", "MONGODB_AUTH_SOURCE"]
  },
  postgres: {
    connectionString: ["DATABASE_PUBLIC_URL", "DATABASE_URL", "POSTGRES_PUBLIC_URL", "POSTGRES_URL"],
    databaseName: ["PGDATABASE", "POSTGRES_DB"],
    ssl: ["POSTGRES_SSL"]
  },
  mysql: {
    connectionString: ["MYSQL_PUBLIC_URL", "MYSQL_URL"],
    databaseName: ["MYSQL_DATABASE", "MYSQLDATABASE"],
    ssl: ["MYSQL_SSL"]
  },
  bucket: {
    endpoint: ["BUCKET_ENDPOINT", "S3_ENDPOINT", "AWS_ENDPOINT_URL"],
    region: ["BUCKET_REGION", "S3_REGION", "AWS_REGION"],
    bucketName: ["BUCKET_NAME", "S3_BUCKET", "AWS_BUCKET_NAME"],
    accessKeyId: ["BUCKET_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"],
    secretAccessKey: ["BUCKET_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]
  }
};

const REQUIRED_FIELDS = {
  mongodb: ["connectionString"],
  postgres: ["connectionString"],
  mysql: ["connectionString"],
  bucket: ["endpoint", "region", "bucketName", "accessKeyId", "secretAccessKey"]
};

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
  const resolved = { ...body };
  for (const [field, envNames] of Object.entries(mapping)) {
    if (!String(resolved[field] || "").trim()) {
      const envValue = firstEnv(envNames);
      if (envValue) {
        resolved[field] = envValue;
        resolved.__usedDeploymentEnv = true;
      }
    }
  }
  return resolved;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] || "").trim());
  if (missing.length) {
    const err = new Error(`Missing required fields: ${missing.join(", ")}`);
    err.statusCode = 200;
    throw err;
  }
}

function withTimeout(work, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    work,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Connection timed out. Check that the Railway public URL is reachable.")), timeoutMs);
    })
  ]);
}

function redact(value = "") {
  return String(value)
    .replace(/:\/\/([^:/?#]+):([^@]+)@/g, "://$1:******@")
    .replace(/(password|secretAccessKey|accessKeyId)=([^&\s]+)/gi, "$1=******");
}

export async function testConnectionTarget(body = {}) {
  const target = body.target;

  if (target === "mongodb") {
    const config = withDeploymentEnv(body, ENV_MAPPINGS.mongodb);
    requireFields(config, ["connectionString"]);
    const client = new MongoClient(config.connectionString, {
      authSource: config.authSource || undefined,
      serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS
    });
    await withTimeout(client.connect());
    let pong;
    try {
      pong = await client.db(config.databaseName || "admin").command({ ping: 1 });
    } finally {
      await client.close();
    }
    return {
      target: "MongoDB",
      source: config.__usedDeploymentEnv ? "deployment env" : "form",
      endpoint: redact(config.connectionString),
      database: config.databaseName || "admin",
      response: pong.ok === 1 ? "ping ok" : "ping returned"
    };
  }

  if (target === "postgres") {
    const config = withDeploymentEnv(body, ENV_MAPPINGS.postgres);
    if ((body.useDeploymentEnv || config.__usedDeploymentEnv) && config.ssl === undefined) config.ssl = readBooleanEnv("DATABASE_SSL", true);
    config.ssl = coerceBoolean(config.ssl);
    requireFields(config, ["connectionString"]);
    const client = new pg.Client({
      connectionString: config.connectionString,
      connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    });
    await withTimeout(client.connect());
    let version;
    try {
      version = await client.query("select version()");
    } finally {
      await client.end();
    }
    return {
      target: "Postgres",
      source: config.__usedDeploymentEnv ? "deployment env" : "form",
      endpoint: redact(config.connectionString),
      database: config.databaseName || "default",
      response: version.rows?.[0]?.version?.split(" ").slice(0, 2).join(" ") || "query ok"
    };
  }

  if (target === "mysql") {
    const config = withDeploymentEnv(body, ENV_MAPPINGS.mysql);
    config.ssl = coerceBoolean(config.ssl);
    requireFields(config, ["connectionString"]);
    const connection = await withTimeout(mysql.createConnection({
      uri: config.connectionString,
      connectTimeout: DEFAULT_TIMEOUT_MS,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    }));
    let rows;
    try {
      [rows] = await connection.query("select version() as version");
    } finally {
      await connection.end();
    }
    return {
      target: "MySQL",
      source: config.__usedDeploymentEnv ? "deployment env" : "form",
      endpoint: redact(config.connectionString),
      database: config.databaseName || "default",
      response: rows?.[0]?.version || "query ok"
    };
  }

  if (target === "bucket") {
    const config = withDeploymentEnv(body, ENV_MAPPINGS.bucket);
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
    return {
      target: "Bucket",
      source: config.__usedDeploymentEnv ? "deployment env" : "form",
      endpoint: config.endpoint,
      bucket: config.bucketName,
      region: config.region,
      response: "HeadBucket ok"
    };
  }

  const err = new Error("Unknown connection target.");
  err.statusCode = 200;
  throw err;
}

export function errorStatus(error) {
  const statusCode = error.statusCode || 500;
  return statusCode >= 500 ? 500 : 200;
}

export function getDeploymentEnvStatus() {
  return Object.fromEntries(
    Object.entries(ENV_MAPPINGS).map(([target, mapping]) => {
      const fields = Object.fromEntries(
        Object.entries(mapping).map(([field, envNames]) => [field, Boolean(firstEnv(envNames))])
      );
      const missing = REQUIRED_FIELDS[target].filter((field) => !fields[field]);
      return [
        target,
        {
          available: missing.length === 0,
          fields,
          missing
        }
      ];
    })
  );
}
