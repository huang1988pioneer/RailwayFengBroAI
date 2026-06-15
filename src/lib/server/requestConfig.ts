import type { StoreConfig } from "./dataStore";

export function readStoreConfig(request: Request): StoreConfig {
  const raw = request.headers.get("X-FengBro-DB-Config");
  if (!raw) return {};

  try {
    const json = decodeURIComponent(
      Array.from(atob(raw))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    const parsed = JSON.parse(json) as StoreConfig;
    return {
      provider: parsed.provider,
      connectionString: String(parsed.connectionString || ""),
      databaseName: String(parsed.databaseName || ""),
      ssl: parsed.ssl !== false,
    };
  } catch {
    return {};
  }
}
