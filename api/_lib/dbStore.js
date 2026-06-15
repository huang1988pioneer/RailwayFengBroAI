import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";
import pg from "pg";

const TABLE_NAME = "fengbro_records";
const MONGO_COLLECTION_NAME = "records";

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function handleError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);
  sendJson(res, status, {
    ok: false,
    error: error instanceof Error ? error.message : "Server error",
  });
}

export function parseDbConfig(req) {
  const header = req.headers["x-fengbro-db-config"];
  if (header) {
    const json = Buffer.from(String(header), "base64").toString("utf8");
    return normalizeConfig(JSON.parse(json));
  }

  return normalizeConfig({
    provider: process.env.DB_PROVIDER || process.env.DATABASE_PROVIDER || detectProvider(),
    connectionString:
      process.env.DATABASE_PUBLIC_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PUBLIC_URL ||
      process.env.POSTGRES_URL ||
      process.env.MYSQL_PUBLIC_URL ||
      process.env.MYSQL_URL ||
      process.env.MONGO_PUBLIC_URL ||
      process.env.MONGO_URL ||
      process.env.MONGODB_URI ||
      "",
    databaseName: process.env.DB_NAME || process.env.MONGO_DATABASE || process.env.MYSQL_DATABASE || process.env.POSTGRES_DATABASE || "fengbro",
    ssl: process.env.DB_SSL !== "false" && process.env.DATABASE_SSL !== "false",
  });
}

export async function createStoreFromRequest(req) {
  const config = parseDbConfig(req);
  if (!config.connectionString) {
    const error = new Error("請先在鋒兄設定填入資料庫連線字串。");
    error.statusCode = 400;
    throw error;
  }

  if (config.provider === "mongodb") return createMongoStore(config);
  if (config.provider === "postgres") return createPostgresStore(config);
  if (config.provider === "mysql") return createMysqlStore(config);

  const error = new Error("不支援的資料庫類型。");
  error.statusCode = 400;
  throw error;
}

export function requestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}

function detectProvider() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "";
  if (process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI || url.startsWith("mongodb")) return "mongodb";
  if (process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL || url.startsWith("mysql")) return "mysql";
  if (process.env.POSTGRES_PUBLIC_URL || process.env.POSTGRES_URL || url.startsWith("postgres")) return "postgres";
  return "mongodb";
}

function normalizeConfig(config) {
  const provider = String(config.provider || "").toLowerCase();
  return {
    provider: provider === "mongo" ? "mongodb" : provider === "postgresql" ? "postgres" : provider,
    connectionString: String(config.connectionString || config.url || ""),
    databaseName: String(config.databaseName || config.database || config.dbName || "fengbro"),
    ssl: config.ssl !== false,
  };
}

function now() {
  return new Date().toISOString();
}

function newRecord(module, data) {
  const stamp = now();
  return {
    id: crypto.randomUUID(),
    module,
    data,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

async function createMongoStore(config) {
  const client = new MongoClient(config.connectionString);
  await client.connect();
  const db = client.db(config.databaseName || "fengbro");
  const collection = db.collection(MONGO_COLLECTION_NAME);
  await collection.createIndex({ module: 1, updatedAt: -1 });

  return {
    provider: "mongodb",
    database: db.databaseName,
    storage: { type: "collection", name: MONGO_COLLECTION_NAME, mode: "single" },
    async health() {
      await db.command({ ping: 1 });
      await client.close();
      return { ok: true, provider: "mongodb", database: db.databaseName, collection: MONGO_COLLECTION_NAME };
    },
    async setup() {
      await db.command({ ping: 1 });
      await collection.createIndex({ module: 1, updatedAt: -1 });
      await client.close();
      return {
        ok: true,
        provider: "mongodb",
        database: db.databaseName,
        collection: MONGO_COLLECTION_NAME,
        recommendation: "single collection + module field",
      };
    },
    async list(module) {
      const records = await collection.find({ module }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
      await client.close();
      return records;
    },
    async create(module, data) {
      const item = newRecord(module, data);
      await collection.insertOne(item);
      await client.close();
      return item;
    },
    async update(module, id, data) {
      const updatedAt = now();
      const result = await collection.findOneAndUpdate(
        { id, module },
        { $set: { data, updatedAt } },
        { returnDocument: "after", projection: { _id: 0 } },
      );
      await client.close();
      if (!result) throw notFound();
      return result;
    },
    async remove(module, id) {
      await collection.deleteOne({ id, module });
      await client.close();
    },
  };
}

async function createPostgresStore(config) {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_module ON ${TABLE_NAME}(module)`);

  return {
    provider: "postgres",
    storage: { type: "table", name: TABLE_NAME, mode: "single" },
    async health() {
      await pool.query("SELECT 1 AS ok");
      await pool.end();
      return { ok: true, provider: "postgres", database: config.databaseName, table: TABLE_NAME };
    },
    async setup() {
      await pool.query("SELECT 1 AS ok");
      await pool.end();
      return {
        ok: true,
        provider: "postgres",
        database: config.databaseName,
        table: TABLE_NAME,
        recommendation: "single table + module column",
      };
    },
    async list(module) {
      const result = await pool.query(`SELECT * FROM ${TABLE_NAME} WHERE module=$1 ORDER BY updated_at DESC`, [module]);
      await pool.end();
      return result.rows.map(fromSqlRow);
    },
    async create(module, data) {
      const item = newRecord(module, data);
      await pool.query(`INSERT INTO ${TABLE_NAME}(id,module,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5)`, [
        item.id,
        item.module,
        item.data,
        item.createdAt,
        item.updatedAt,
      ]);
      await pool.end();
      return item;
    },
    async update(module, id, data) {
      const updatedAt = now();
      const result = await pool.query(`UPDATE ${TABLE_NAME} SET data=$1, updated_at=$2 WHERE id=$3 AND module=$4 RETURNING *`, [
        data,
        updatedAt,
        id,
        module,
      ]);
      await pool.end();
      if (!result.rows[0]) throw notFound();
      return fromSqlRow(result.rows[0]);
    },
    async remove(module, id) {
      await pool.query(`DELETE FROM ${TABLE_NAME} WHERE id=$1 AND module=$2`, [id, module]);
      await pool.end();
    },
  };
}

async function createMysqlStore(config) {
  const pool = mysql.createPool({
    uri: config.connectionString,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id VARCHAR(64) PRIMARY KEY,
      module VARCHAR(80) NOT NULL,
      data JSON NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      INDEX idx_${TABLE_NAME}_module (module)
    )
  `);

  return {
    provider: "mysql",
    storage: { type: "table", name: TABLE_NAME, mode: "single" },
    async health() {
      await pool.query("SELECT 1 AS ok");
      await pool.end();
      return { ok: true, provider: "mysql", database: config.databaseName, table: TABLE_NAME };
    },
    async setup() {
      await pool.query("SELECT 1 AS ok");
      await pool.end();
      return {
        ok: true,
        provider: "mysql",
        database: config.databaseName,
        table: TABLE_NAME,
        recommendation: "single table + module column",
      };
    },
    async list(module) {
      const [rows] = await pool.query(`SELECT * FROM ${TABLE_NAME} WHERE module=? ORDER BY updated_at DESC`, [module]);
      await pool.end();
      return rows.map(fromSqlRow);
    },
    async create(module, data) {
      const item = newRecord(module, data);
      await pool.query(`INSERT INTO ${TABLE_NAME}(id,module,data,created_at,updated_at) VALUES(?,?,?,?,?)`, [
        item.id,
        item.module,
        JSON.stringify(item.data),
        toMysqlDate(item.createdAt),
        toMysqlDate(item.updatedAt),
      ]);
      await pool.end();
      return item;
    },
    async update(module, id, data) {
      const updatedAt = now();
      const [result] = await pool.query(`UPDATE ${TABLE_NAME} SET data=?, updated_at=? WHERE id=? AND module=?`, [
        JSON.stringify(data),
        toMysqlDate(updatedAt),
        id,
        module,
      ]);
      await pool.end();
      if (result.affectedRows === 0) throw notFound();
      return { id, module, data, createdAt: updatedAt, updatedAt };
    },
    async remove(module, id) {
      await pool.query(`DELETE FROM ${TABLE_NAME} WHERE id=? AND module=?`, [id, module]);
      await pool.end();
    },
  };
}

function fromSqlRow(row) {
  return {
    id: row.id,
    module: row.module,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toMysqlDate(value) {
  return value.slice(0, 19).replace("T", " ");
}

function notFound() {
  const error = new Error("Record not found");
  error.statusCode = 404;
  return error;
}
