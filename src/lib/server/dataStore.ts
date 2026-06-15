import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";
import pg from "pg";

export type RecordItem = {
  id: string;
  module: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  list(module: string): Promise<RecordItem[]>;
  create(module: string, data: Record<string, unknown>): Promise<RecordItem>;
  update(module: string, id: string, data: Record<string, unknown>): Promise<RecordItem>;
  remove(module: string, id: string): Promise<void>;
  health(): Promise<Record<string, unknown>>;
};

export type StoreProvider = "local" | "mongodb" | "postgres" | "postgresql" | "mysql" | "mongo";

export type StoreConfig = {
  provider?: StoreProvider | string;
  connectionString?: string;
  databaseName?: string;
  ssl?: boolean;
};

const storePromises = new Map<string, Promise<Store>>();

export function getDataStore(config: StoreConfig = {}) {
  const key = storeKey(config);
  if (!storePromises.has(key)) {
    storePromises.set(key, createStore(config));
  }
  return storePromises.get(key)!;
}

async function createStore(config: StoreConfig = {}): Promise<Store> {
  const provider = (config.provider || process.env.DB_PROVIDER || process.env.DATABASE_PROVIDER || detectProvider()).toLowerCase();
  if (provider === "postgres" || provider === "postgresql") return createPostgresStore(config);
  if (provider === "mysql") return createMysqlStore(config);
  if (provider === "mongodb" || provider === "mongo") return createMongoStore(config);
  return createLocalStore();
}

function storeKey(config: StoreConfig) {
  const provider = config.provider || process.env.DB_PROVIDER || process.env.DATABASE_PROVIDER || detectProvider();
  return JSON.stringify({
    provider,
    connectionString: config.connectionString || "",
    databaseName: config.databaseName || "",
    ssl: config.ssl,
  });
}

function detectProvider() {
  const url = process.env.DATABASE_URL || "";
  if (process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI || url.startsWith("mongodb")) return "mongodb";
  if (process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL || url.startsWith("mysql")) return "mysql";
  if (process.env.POSTGRES_PUBLIC_URL || process.env.POSTGRES_URL || process.env.DATABASE_PUBLIC_URL || url.startsWith("postgres")) return "postgres";
  return "local";
}

function now() {
  return new Date().toISOString();
}

function newRecord(module: string, data: Record<string, unknown>): RecordItem {
  const stamp = now();
  return {
    id: crypto.randomUUID(),
    module,
    data,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

async function createLocalStore(): Promise<Store> {
  const dataDir = path.join(process.cwd(), ".data");
  const filePath = path.join(dataDir, "records.json");
  await mkdir(dataDir, { recursive: true });

  async function readAll(): Promise<RecordItem[]> {
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as RecordItem[];
    } catch {
      return [];
    }
  }

  async function writeAll(records: RecordItem[]) {
    await writeFile(filePath, JSON.stringify(records, null, 2), "utf8");
  }

  return {
    async list(module) {
      return (await readAll()).filter((item) => item.module === module);
    },
    async create(module, data) {
      const records = await readAll();
      const item = newRecord(module, data);
      records.unshift(item);
      await writeAll(records);
      return item;
    },
    async update(module, id, data) {
      const records = await readAll();
      const index = records.findIndex((item) => item.id === id && item.module === module);
      if (index < 0) throw new Response("Record not found", { status: 404 });
      records[index] = { ...records[index], data, updatedAt: now() };
      await writeAll(records);
      return records[index];
    },
    async remove(module, id) {
      const records = await readAll();
      await writeAll(records.filter((item) => !(item.id === id && item.module === module)));
    },
    async health() {
      return { provider: "local", filePath };
    },
  };
}

async function createPostgresStore(config: StoreConfig = {}): Promise<Store> {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: config.connectionString || process.env.POSTGRES_PUBLIC_URL || process.env.POSTGRES_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
    ssl: config.ssl === false || process.env.POSTGRES_SSL === "false" || process.env.DATABASE_SSL === "false" || process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fengbro_records (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_fengbro_records_module ON fengbro_records(module)");

  return {
    async list(module) {
      const result = await pool.query("SELECT * FROM fengbro_records WHERE module=$1 ORDER BY updated_at DESC", [module]);
      return result.rows.map(fromSqlRow);
    },
    async create(module, data) {
      const item = newRecord(module, data);
      await pool.query("INSERT INTO fengbro_records(id,module,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5)", [
        item.id,
        item.module,
        item.data,
        item.createdAt,
        item.updatedAt,
      ]);
      return item;
    },
    async update(module, id, data) {
      const updatedAt = now();
      const result = await pool.query(
        "UPDATE fengbro_records SET data=$1, updated_at=$2 WHERE id=$3 AND module=$4 RETURNING *",
        [data, updatedAt, id, module],
      );
      if (!result.rows[0]) throw new Response("Record not found", { status: 404 });
      return fromSqlRow(result.rows[0]);
    },
    async remove(module, id) {
      await pool.query("DELETE FROM fengbro_records WHERE id=$1 AND module=$2", [id, module]);
    },
    async health() {
      const result = await pool.query("SELECT 1 AS ok");
      return { provider: "postgres", ok: result.rows[0]?.ok === 1 };
    },
  };
}

async function createMysqlStore(config: StoreConfig = {}): Promise<Store> {
  const pool = mysql.createPool({
    uri: config.connectionString || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL || process.env.DATABASE_URL || "",
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fengbro_records (
      id VARCHAR(64) PRIMARY KEY,
      module VARCHAR(80) NOT NULL,
      data JSON NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      INDEX idx_fengbro_records_module (module)
    )
  `);

  return {
    async list(module) {
      const [rows] = await pool.query("SELECT * FROM fengbro_records WHERE module=? ORDER BY updated_at DESC", [module]);
      return (rows as any[]).map(fromSqlRow);
    },
    async create(module, data) {
      const item = newRecord(module, data);
      await pool.query("INSERT INTO fengbro_records(id,module,data,created_at,updated_at) VALUES(?,?,?,?,?)", [
        item.id,
        item.module,
        JSON.stringify(item.data),
        item.createdAt.slice(0, 19).replace("T", " "),
        item.updatedAt.slice(0, 19).replace("T", " "),
      ]);
      return item;
    },
    async update(module, id, data) {
      const updatedAt = now();
      const [result] = await pool.query("UPDATE fengbro_records SET data=?, updated_at=? WHERE id=? AND module=?", [
        JSON.stringify(data),
        updatedAt.slice(0, 19).replace("T", " "),
        id,
        module,
      ]);
      if ((result as { affectedRows?: number }).affectedRows === 0) throw new Response("Record not found", { status: 404 });
      return { id, module, data, createdAt: updatedAt, updatedAt };
    },
    async remove(module, id) {
      await pool.query("DELETE FROM fengbro_records WHERE id=? AND module=?", [id, module]);
    },
    async health() {
      const [rows] = await pool.query("SELECT 1 AS ok");
      return { provider: "mysql", ok: Array.isArray(rows) };
    },
  };
}

async function createMongoStore(config: StoreConfig = {}): Promise<Store> {
  const client = new MongoClient(config.connectionString || process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.DATABASE_URL || "");
  await client.connect();
  const db = client.db(config.databaseName || process.env.MONGO_DATABASE || process.env.DB_NAME || "fengbro");
  const collection = db.collection<RecordItem>("records");
  await collection.createIndex({ module: 1 });

  return {
    async list(module) {
      return collection.find({ module }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
    },
    async create(module, data) {
      const item = newRecord(module, data);
      await collection.insertOne(item);
      return item;
    },
    async update(module, id, data) {
      const updatedAt = now();
      const result = await collection.findOneAndUpdate(
        { id, module },
        { $set: { data, updatedAt } },
        { returnDocument: "after", projection: { _id: 0 } },
      );
      if (!result) throw new Response("Record not found", { status: 404 });
      return result;
    },
    async remove(module, id) {
      await collection.deleteOne({ id, module });
    },
    async health() {
      await db.command({ ping: 1 });
      return { provider: "mongodb", database: db.databaseName };
    },
  };
}

function fromSqlRow(row: any): RecordItem {
  return {
    id: row.id,
    module: row.module,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
