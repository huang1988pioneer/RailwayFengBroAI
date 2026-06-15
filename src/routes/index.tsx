import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileUp,
  Loader2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { coerceCsvValue, parseCsv, toCsv } from "../lib/csv";
import { DATA_MODULES, FieldDef, ModuleDef, TOOL_CHILD_MODULES, getModule, getPrimaryField } from "../lib/modules";

type RecordItem = {
  id: string;
  module: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type BackendHealth = {
  ok: boolean;
  provider?: string;
  database?: string;
  message?: string;
};

type DbProvider = "mongodb" | "postgres" | "mysql";

type DbSettings = {
  provider: DbProvider;
  connectionString: string;
  databaseName: string;
  ssl: boolean;
};

type UploadPayload = {
  key: string;
  url: string;
  bucketUrl?: string;
  name: string;
  type: string;
  size: number;
};

const DB_SETTINGS_KEY = "fengbro.db.settings";

const DEFAULT_DB_SETTINGS: DbSettings = {
  provider: "mongodb",
  connectionString: "",
  databaseName: "fengbro",
  ssl: true,
};

export const Route = createFileRoute("/")({
  component: FengBroWorkspace,
});

export function FengBroWorkspace() {
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState("subscription");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState("");
  const [importRows, setImportRows] = useState<Array<Record<string, string>> | null>(null);
  const [dbSettings, setDbSettings] = useState<DbSettings>(DEFAULT_DB_SETTINGS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const module = getModule(activeId);

  useEffect(() => {
    setMounted(true);
    setDbSettings(readDbSettings());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void loadHealth(dbSettings);
  }, [dbSettings, mounted]);

  useEffect(() => {
    if (!mounted) return;
    resetForm(module);
    void loadRecords(module.id);
  }, [module.id, mounted]);

  async function loadHealth(settings = dbSettings) {
    if (!hasDbSettings(settings)) {
      setHealth({ ok: false, provider: settings.provider, message: "請先在鋒兄設定儲存資料庫連線。" });
      return;
    }

    try {
      const response = await fetch("/api/health", { headers: dbHeaders(settings, false) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "資料庫連線失敗");
      setHealth(payload);
    } catch (error) {
      setHealth({
        ok: false,
        provider: settings.provider,
        message: error instanceof Error ? error.message : "資料庫連線失敗",
      });
    }
  }

  async function loadRecords(moduleId = activeId) {
    if (!hasDbSettings(dbSettings)) {
      setRecords([]);
      setNotice("請先到鋒兄設定選擇 MongoDB、Postgres 或 MySQL，並儲存連線字串。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/records/${moduleId}`, { headers: dbHeaders(dbSettings, false) });
      if (!response.ok) throw new Error(await readError(response));
      setRecords(await response.json());
    } catch (error) {
      setRecords([]);
      setNotice(error instanceof Error ? error.message : "資料讀取失敗，請檢查鋒兄設定。");
    } finally {
      setLoading(false);
    }
  }

  function resetForm(targetModule = module) {
    setEditing(null);
    setImportRows(null);
    setForm({
      ...Object.fromEntries(targetModule.fields.map((field) => [field.key, field.type === "boolean" ? false : ""])),
      ...getToolDefaults(targetModule),
    });
  }

  async function saveRecord(event: FormEvent) {
    event.preventDefault();
    if (!hasDbSettings(dbSettings)) {
      setNotice("請先儲存鋒兄資料庫設定，資料不會寫入 localStorage。");
      return;
    }

    const payload = withToolDefaults(module, compactForm(form, module.fields));
    if (!String(payload[getPrimaryField(module)] ?? "").trim()) {
      setNotice("請先填寫必要欄位。");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/records/${module.id}/${editing.id}` : `/api/records/${module.id}`;
      const method = editing ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: dbHeaders(dbSettings),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      setNotice(editing ? "已更新資料庫資料。" : "已新增資料庫資料。");
      resetForm();
      await loadRecords();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "資料寫入失敗，請檢查鋒兄設定。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(item: RecordItem) {
    if (!hasDbSettings(dbSettings)) {
      setNotice("請先儲存鋒兄資料庫設定。");
      return;
    }

    const title = String(item.data[getPrimaryField(module)] ?? item.id);
    if (!confirm(`確定刪除「${title}」？`)) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/records/${module.id}/${item.id}`, {
        method: "DELETE",
        headers: dbHeaders(dbSettings, false),
      });
      if (!response.ok) throw new Error(await readError(response));
      setNotice("已從資料庫刪除。");
      await loadRecords();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "刪除失敗，請檢查資料庫連線。");
    } finally {
      setSaving(false);
    }
  }

  function editRecord(item: RecordItem) {
    setEditing(item);
    setForm(Object.fromEntries(module.fields.map((field) => [field.key, item.data[field.key] ?? (field.type === "boolean" ? false : "")])));
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportCsv() {
    const csv = toCsv(module.csvHeaders, records.map((item) => item.data));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `appwrite-${module.id}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function onCsvSelected(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportRows(parseCsv(String(reader.result || "")));
      setNotice(`已讀取 ${file.name}，請確認後直接匯入目前選擇的資料庫。`);
    };
    reader.readAsText(file, "utf-8");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function executeImport() {
    if (!importRows?.length) return;
    if (!hasDbSettings(dbSettings)) {
      setNotice("請先儲存鋒兄資料庫設定，CSV 匯入不會寫入 localStorage。");
      return;
    }

    setSaving(true);
    let count = 0;
    try {
      for (const row of importRows) {
        const payload = withToolDefaults(module, Object.fromEntries(module.csvHeaders.map((header) => [header, coerceCsvValue(row[header] ?? "")])));
        const primary = getPrimaryField(module);
        const existing = records.find((item) => String(item.data[primary] ?? "") === String(payload[primary] ?? ""));
        const response = await fetch(existing ? `/api/records/${module.id}/${existing.id}` : `/api/records/${module.id}`, {
          method: existing ? "PUT" : "POST",
          headers: dbHeaders(dbSettings),
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await readError(response));
        count += 1;
      }
      setNotice(`CSV 已直接匯入 ${dbSettings.provider}，共 ${count} 筆。`);
      setImportRows(null);
      await loadRecords();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "CSV 匯入失敗，請檢查資料庫連線。");
    } finally {
      setSaving(false);
    }
  }

  function saveDbSettings(nextSettings = dbSettings) {
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(nextSettings));
    setDbSettings(nextSettings);
    setNotice("已儲存鋒兄設定。localStorage 只保存這份資料庫設定，不保存 CRUD 資料。");
    void loadHealth(nextSettings);
    void loadRecords(module.id);
  }

  async function testDbConnection(settings = dbSettings) {
    if (!hasDbSettings(settings)) {
      setNotice("請先填入 MongoDB、Postgres 或 MySQL 連線字串。");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: settings.provider,
          connectionString: settings.connectionString,
          databaseName: settings.databaseName,
          ssl: settings.ssl,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Database connection test failed");
      setHealth({ ok: true, provider: settings.provider, database: payload.details?.database || settings.databaseName });
      setNotice(`${payload.details?.target || settings.provider} 連線成功：${payload.details?.response || "ok"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database connection test failed";
      setHealth({ ok: false, provider: settings.provider, message });
      setNotice(message);
    } finally {
      setSaving(false);
    }
  }

  async function initializeStorage(settings = dbSettings) {
    if (!hasDbSettings(settings)) {
      setNotice("請先儲存資料庫連線設定，再初始化 Table 或 Collection。");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: dbHeaders(settings),
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Storage initialization failed");
      setHealth({ ok: true, provider: payload.provider || settings.provider, database: payload.database || settings.databaseName });
      setNotice(`初始化完成：${payload.collection ? `Collection ${payload.collection}` : `Table ${payload.table || "fengbro_records"}`}`);
      await loadRecords(module.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Storage initialization failed");
    } finally {
      setSaving(false);
    }
  }

  async function testBucketConnection() {
    setSaving(true);
    try {
      const response = await fetch("/api/test-bucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Bucket connection test failed");
      setNotice(`Bucket 連線成功：${payload.details?.bucket || payload.details?.endpoint || "ok"}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Bucket connection test failed");
    } finally {
      setSaving(false);
    }
  }

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((item) => JSON.stringify(item.data).toLowerCase().includes(needle));
  }, [query, records]);

  const stats = useMemo(() => {
    const total = records.length;
    const priced = records.reduce((sum, item) => sum + Number(item.data.price || item.data.deposit || 0), 0);
    const withFiles = records.filter((item) => JSON.stringify(item.data).includes("bucketUrl")).length;
    return { total, priced, withFiles };
  }, [records]);

  if (!mounted) {
    return (
      <main className="shell boot-shell">
        <section className="boot-panel">
          <Loader2 className="spin" size={22} />
          <span>鋒兄 AI 載入中</span>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">鋒</div>
          <div>
            <p>FengBro</p>
            <h1>鋒兄 AI</h1>
          </div>
        </div>

        <nav className="nav-list">
          {DATA_MODULES.map((item) => (
            <button
              key={item.id}
              className={item.id === module.id ? "active" : ""}
              type="button"
              onClick={() => setActiveId(item.id)}
            >
              <item.icon size={18} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.subtitle}</small>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>TanStack Start CRUD Workspace</p>
            <h2>{module.label}</h2>
          </div>
          <div className="topbar-actions">
            <span className={health?.ok ? "status ok" : "status"}>
              <Database size={15} />
              {health?.ok ? `${health.provider} ready` : health?.provider ?? "未設定"}
            </span>
            <button className="ghost-button" type="button" onClick={() => loadRecords()}>
              重新讀取
            </button>
          </div>
        </header>

        <section className="metrics">
          <Metric label="資料筆數" value={stats.total.toLocaleString("zh-TW")} />
          <Metric label="金額合計" value={stats.priced.toLocaleString("zh-TW")} />
          <Metric label="Bucket 檔案" value={stats.withFiles.toLocaleString("zh-TW")} />
        </section>

        {module.id === "settings" ? (
          <SettingsGuide
            settings={dbSettings}
            health={health}
            onChange={setDbSettings}
            onSave={saveDbSettings}
            onTest={() => testDbConnection(dbSettings)}
            onInit={() => initializeStorage(dbSettings)}
            onBucketTest={testBucketConnection}
          />
        ) : null}
        {module.id === "about" ? <AboutPanel /> : null}
        {module.id === "tools" ? <ToolsHub onOpen={setActiveId} /> : null}
        {isToolChild(module) ? (
          <ToolWorkspace
            module={module}
            records={filteredRecords}
            onDraft={(draft) => {
              setEditing(null);
              setForm((previous) => ({ ...previous, ...getToolDefaults(module), ...draft }));
              setNotice(`已帶入 ${module.label} 範本，可直接儲存到資料庫。`);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ) : null}

        {module.fields.length ? <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h3>{editing ? "編輯資料" : "新增資料"}</h3>
              <p>資料直接寫入目前選擇的 MongoDB、Postgres 或 MySQL；CSV 欄位沿用 Appwrite 格式。</p>
            </div>
            {editing ? (
              <button className="icon-action" type="button" onClick={() => resetForm()}>
                <X size={17} />
              </button>
            ) : null}
          </div>

          <form className="record-form" onSubmit={saveRecord}>
            {module.fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                module={module}
                value={form[field.key]}
                onChange={(value) => setForm((previous) => ({ ...previous, [field.key]: value }))}
                onUploadComplete={(payload) => {
                  setForm((previous) => ({
                    ...previous,
                    [field.key]: payload.url,
                    ...(module.kind === "media" ? {
                      bucketUrl: payload.bucketUrl || payload.url,
                      title: previous.title || payload.name,
                    } : {}),
                  }));
                }}
                onNotice={setNotice}
              />
            ))}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? <Loader2 className="spin" size={17} /> : editing ? <Check size={17} /> : <Plus size={17} />}
                {editing ? "更新資料" : "新增資料"}
              </button>
              <button className="ghost-button" type="button" onClick={() => resetForm()}>
                清空
              </button>
              {notice ? <span className="notice">{notice}</span> : null}
            </div>
          </form>
          {getMediaKind(module) ? <MediaPreviewCard module={module} data={form} title="即時預覽" /> : null}
        </section> : null}

        {module.csvHeaders.length ? <section className="panel">
          <div className="toolbar">
            <label className="search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜尋 ${module.label}`} />
            </label>
            <div className="toolbar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(event) => onCsvSelected(event.target.files?.[0])}
              />
              <button className="ghost-button" type="button" onClick={() => fileInputRef.current?.click()}>
                <FileUp size={16} />
                匯入 CSV
              </button>
              <button className="ghost-button" type="button" onClick={exportCsv} disabled={!module.csvHeaders.length}>
                <Download size={16} />
                匯出 CSV
              </button>
            </div>
          </div>

          {importRows ? (
            <div className="import-preview">
              <div>
                <h3>CSV 匯入預覽</h3>
                <p>讀到 {importRows.length} 筆，確認後會直接寫入目前選擇的資料庫。</p>
              </div>
              <div className="preview-list">
                {importRows.slice(0, 6).map((row, index) => (
                  <span key={`${index}-${JSON.stringify(row)}`}>{String(row[getPrimaryField(module)] ?? row.name ?? row.title ?? `第 ${index + 1} 筆`)}</span>
                ))}
              </div>
              <div className="form-actions">
                <button className="primary-button" type="button" onClick={executeImport} disabled={saving}>
                  <UploadCloud size={17} />
                  確認匯入
                </button>
                <button className="ghost-button" type="button" onClick={() => setImportRows(null)}>
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {getMediaKind(module) && filteredRecords.length ? <MediaGallery module={module} records={filteredRecords} /> : null}

          {loading ? (
            <div className="empty-state">
              <Loader2 className="spin" />資料讀取中
            </div>
          ) : filteredRecords.length ? (
            <RecordTable module={module} records={filteredRecords} onEdit={editRecord} onDelete={deleteRecord} />
          ) : (
            <div className="empty-state">目前沒有資料。請先設定資料庫，或匯入 CSV。</div>
          )}
        </section> : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getMediaKind(module: ModuleDef) {
  if (module.id === "images") return "image";
  if (module.id === "videos") return "video";
  if (module.id === "music") return "audio";
  if (module.id === "podcast") return "podcast";
  if (module.id === "documents") return "document";
  return "";
}

function getMediaUrl(data: Record<string, unknown>) {
  const candidates = [data.bucketUrl, data.url, data.file, data.photo]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return candidates[0] || "";
}

function getMediaTitle(data: Record<string, unknown>, fallback = "媒體預覽") {
  return String(data.title || data.name || data.description || fallback).trim();
}

function MediaGallery({ module, records }: { module: ModuleDef; records: RecordItem[] }) {
  const mediaRecords = records.filter((item) => getMediaUrl(item.data)).slice(0, 8);
  if (!mediaRecords.length) return null;
  return (
    <div className="media-gallery">
      {mediaRecords.map((item) => (
        <MediaPreviewCard key={item.id} module={module} data={item.data} title={getMediaTitle(item.data)} compact />
      ))}
    </div>
  );
}

function MediaPreviewCard({
  module,
  data,
  title,
  compact = false,
}: {
  module: ModuleDef;
  data: Record<string, unknown>;
  title: string;
  compact?: boolean;
}) {
  const kind = getMediaKind(module);
  const url = getMediaUrl(data);
  if (!kind || !url) return null;

  return (
    <article className={`media-preview ${compact ? "compact" : ""}`}>
      <div className="media-preview-heading">
        <strong>{title}</strong>
        <a href={url} target="_blank" rel="noreferrer">
          開啟 <ExternalLink size={13} />
        </a>
      </div>
      <MediaPlayer kind={kind} url={url} title={title} />
    </article>
  );
}

function MediaPlayer({ kind, url, title }: { kind: string; url: string; title: string }) {
  if (kind === "image") {
    return <img className="media-image" src={url} alt={title} loading="lazy" referrerPolicy="no-referrer" />;
  }
  if (kind === "video") {
    return <video className="media-video" src={url} controls preload="metadata" />;
  }
  if (kind === "audio" || kind === "podcast") {
    return <audio className="media-audio" src={url} controls preload="metadata" />;
  }
  return (
    <iframe
      className="media-document"
      src={url}
      title={title}
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-downloads"
    />
  );
}

function FieldControl({
  field,
  module,
  value,
  onChange,
  onUploadComplete,
  onNotice,
}: {
  field: FieldDef;
  module: ModuleDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onUploadComplete: (payload: UploadPayload) => void;
  onNotice: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const isFile = field.type === "file";

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module", module.id);
      formData.append("field", field.key);
      if (module.kind === "media") formData.append("requireBucket", "true");
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      onUploadComplete(payload);
      onNotice(`已上傳 ${file.name} 到 Bucket。`);
    } catch (error) {
      if (module.kind === "media") {
        onNotice(error instanceof Error ? error.message : "Bucket 上傳失敗，請檢查設定。");
      } else {
        const localUrl = URL.createObjectURL(file);
        onChange(localUrl);
        onNotice(`已用瀏覽器暫存 ${file.name}。`);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className={field.wide || field.type === "textarea" || isFile ? "wide" : ""}>
      <span>
        {field.label}
        {field.required ? <b>*</b> : null}
      </span>
      {field.type === "textarea" ? (
        <textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : field.type === "boolean" ? (
        <span className="switch-row">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
          啟用 / 繼續
        </span>
      ) : isFile ? (
        <span className="upload-field">
          <input type="file" accept={field.accept} onChange={(event) => upload(event.target.files?.[0])} />
          {uploading ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />}
          {value ? (
            <a href={String(value)} target="_blank" rel="noreferrer">
              已有檔案
            </a>
          ) : (
            <em>{module.kind === "media" ? "上傳到 Bucket" : "選擇檔案"}</em>
          )}
        </span>
      ) : (
        <input
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "url" ? "url" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(field.type === "number" ? Number(event.target.value || 0) : event.target.value)}
        />
      )}
    </label>
  );
}

function RecordTable({
  module,
  records,
  onEdit,
  onDelete,
}: {
  module: ModuleDef;
  records: RecordItem[];
  onEdit: (item: RecordItem) => void;
  onDelete: (item: RecordItem) => void;
}) {
  const visibleHeaders = module.csvHeaders.slice(0, Math.min(module.csvHeaders.length, 7));
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {getMediaKind(module) ? <th>預覽</th> : null}
            {visibleHeaders.map((header) => (
              <th key={header}>{header}</th>
            ))}
            <th>動作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((item) => (
            <tr key={item.id}>
              {getMediaKind(module) ? (
                <td>
                  <TableMediaPreview module={module} item={item} />
                </td>
              ) : null}
              {visibleHeaders.map((header) => (
                <td key={header}>
                  <CellValue value={item.data[header]} />
                </td>
              ))}
              <td>
                <div className="row-actions">
                  <button type="button" onClick={() => onEdit(item)} title="編輯">
                    <Edit3 size={15} />
                  </button>
                  <button type="button" onClick={() => onDelete(item)} title="刪除">
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableMediaPreview({ module, item }: { module: ModuleDef; item: RecordItem }) {
  const kind = getMediaKind(module);
  const url = getMediaUrl(item.data);
  const title = getMediaTitle(item.data);
  if (!kind || !url) return <span>-</span>;

  return (
    <div className="table-media-preview">
      <MediaPlayer kind={kind} url={url} title={title} />
      <a className="table-link" href={url} target="_blank" rel="noreferrer">
        開啟 <ExternalLink size={13} />
      </a>
    </div>
  );
}

function CellValue({ value }: { value: unknown }) {
  const text = value == null || value === "" ? "-" : String(value);
  if (/^https?:\/\//i.test(text)) {
    return (
      <a className="table-link" href={text} target="_blank" rel="noreferrer">
        開啟 <ExternalLink size={13} />
      </a>
    );
  }
  return <span>{text}</span>;
}

function SettingsGuide({
  settings,
  health,
  onChange,
  onSave,
  onTest,
  onInit,
  onBucketTest,
}: {
  settings: DbSettings;
  health: BackendHealth | null;
  onChange: (settings: DbSettings) => void;
  onSave: (settings?: DbSettings) => void;
  onTest: () => void;
  onInit: () => void;
  onBucketTest: () => void;
}) {
  return (
    <section className="panel guide">
      <h3>鋒兄資料庫設定</h3>
      <p>可自由切換 MongoDB、Postgres 或 MySQL。localStorage 只保存這份鋒兄設定，CRUD 與 CSV 匯入資料直接讀寫資料庫。</p>
      <div className="storage-advice">
        <strong>建議資料結構</strong>
        <span>MongoDB：建議單一 <code>records</code> collection，使用 <code>module</code> 欄位區分各鋒兄模組。</span>
        <span>Postgres / MySQL：建議單一 <code>fengbro_records</code> table，使用 <code>module</code> 欄位分流，<code>data</code> JSON 欄位保存模組資料。</span>
        <span>目前欄位會隨鋒兄圖片、影片、音樂、文件、工具等模組變動，單一結構最適合 CSV 匯入、備份和跨資料庫切換。</span>
      </div>
      <div className="settings-grid">
        <label>
          <span>資料庫</span>
          <select value={settings.provider} onChange={(event) => onChange({ ...settings, provider: event.target.value as DbProvider })}>
            <option value="mongodb">MongoDB</option>
            <option value="postgres">Postgres</option>
            <option value="mysql">MySQL</option>
          </select>
        </label>
        <label className="wide">
          <span>連線字串</span>
          <input
            type="password"
            value={settings.connectionString}
            placeholder="mongodb+srv://... 或 postgres://... 或 mysql://..."
            onChange={(event) => onChange({ ...settings, connectionString: event.target.value })}
          />
        </label>
        <label>
          <span>Database / Schema 名稱</span>
          <input value={settings.databaseName} onChange={(event) => onChange({ ...settings, databaseName: event.target.value })} />
        </label>
        <label>
          <span>SSL</span>
          <span className="switch-row">
            <input type="checkbox" checked={settings.ssl} onChange={(event) => onChange({ ...settings, ssl: event.target.checked })} />
            啟用 SSL
          </span>
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="button" onClick={() => onSave(settings)}>
          儲存鋒兄設定
        </button>
        <button className="ghost-button" type="button" onClick={onTest}>
          測試資料庫
        </button>
        <button className="ghost-button" type="button" onClick={onInit}>
          初始化 Table / Collection
        </button>
        <button className="ghost-button" type="button" onClick={onBucketTest}>
          測試 Bucket
        </button>
        <code>{health?.ok ? `${health.provider} ready${health.database ? ` / ${health.database}` : ""}` : health?.message ?? "尚未連線"}</code>
      </div>
    </section>
  );
}

type ToolWorkspaceConfig = {
  title: string;
  kicker: string;
  description: string;
  accent: "amber" | "blue" | "rose" | "green";
  sources: Array<{ label: string; url: string; note: string }>;
  drafts: Array<Record<string, unknown>>;
  cards: Array<{ label: string; value: string; note: string }>;
};

const TOOL_WORKSPACES: Record<string, ToolWorkspaceConfig> = {
  priceCompare: {
    title: "鋒兄比價",
    kicker: "PRICE COMPARE",
    description: "參考 SQLiteCloudFengBroAI 的 BigGo / PChome / momo 比價工作台，先建立查詢紀錄，再把結果保存到目前資料庫。",
    accent: "amber",
    sources: [
      { label: "BigGo", url: "https://biggo.com.tw", note: "商品搜尋與價格趨勢" },
      { label: "PChome 24h", url: "https://24h.pchome.com.tw", note: "台灣電商即時售價" },
      { label: "momo", url: "https://www.momoshop.com.tw", note: "賣場價格與活動" },
    ],
    drafts: [
      { queryText: "Crucial T500 2TB SSD", title: "Crucial T500 2TB PCIe Gen4 NVMe SSD", source: "BigGo / PChome", currentPrice: 10735, highPrice: 10735, lowPrice: 10735, currency: "TWD", resultUrl: "https://biggo.com.tw", notice: "參考 BigGo 歷史價格與 PChome 商品頁。" },
      { queryText: "Dyson V15", title: "Dyson V15 Detect Absolute", source: "momo / PChome", currentPrice: 19900, highPrice: 24900, lowPrice: 18900, currency: "TWD", resultUrl: "https://www.momoshop.com.tw", notice: "建立商品追蹤後補上來源網址。" },
    ],
    cards: [
      { label: "輸入", value: "商品網址 / 關鍵字", note: "可記錄 BigGo、PChome、momo 查詢" },
      { label: "保存", value: "價格歷史", note: "currentPrice / highPrice / lowPrice" },
      { label: "提醒", value: "notice", note: "記錄活動、低價、缺貨與觀察" },
    ],
  },
  phoneCompare: {
    title: "手機比價",
    kicker: "LANDTOP / PHONE",
    description: "參考 SQLiteCloudFengBroAI 的手機比價頁，保存機型、通路價格、最低價來源與查詢時間。",
    accent: "blue",
    sources: [
      { label: "SOGI", url: "https://www.sogi.com.tw", note: "手機規格與建議售價" },
      { label: "地標網通", url: "https://www.landtop.com.tw", note: "門市空機與方案價格" },
      { label: "傑昇通信", url: "https://www.jyes.com.tw", note: "空機價格與促銷" },
    ],
    drafts: [
      { queryText: "iPhone 17", title: "iPhone 17", source: "SOGI / 地標 / 傑昇", currentPrice: 34900, highPrice: 38900, lowPrice: 32900, currency: "TWD", resultUrl: "https://www.sogi.com.tw", notice: "參考截圖預設關鍵字，補上實際通路連結。" },
      { queryText: "Samsung A17 6G 128GB", title: "Samsung A17 6G 128GB", source: "SOGI / 地標 / 傑昇", currentPrice: 4990, highPrice: 7990, lowPrice: 4990, currency: "TWD", resultUrl: "https://www.landtop.com.tw", notice: "記錄地標與傑昇最低價比較。" },
    ],
    cards: [
      { label: "預設", value: "iPhone / Samsung", note: "快速建立常查機型" },
      { label: "比較", value: "建議價 / 通路價", note: "保留高低價欄位" },
      { label: "追蹤", value: "checkedAt", note: "每週更新價格紀錄" },
    ],
  },
  tube: {
    title: "鋒兄Tube",
    kicker: "FENGBRO TUBE",
    description: "參考 SQLiteCloudFengBroAI 的 YouTube / Bilibili 追蹤面板，保存頻道、影片、來源與更新紀錄。",
    accent: "rose",
    sources: [
      { label: "YouTube", url: "https://www.youtube.com", note: "頻道與最新影片" },
      { label: "Bilibili", url: "https://www.bilibili.com", note: "影音來源備援" },
      { label: "RSS Feed", url: "https://www.youtube.com/feeds/videos.xml", note: "頻道 feed 可供 API 後續串接" },
    ],
    drafts: [
      { queryText: "@SunChannelHK", title: "Sun Channel 最新影片", source: "YouTube", currentPrice: 0, highPrice: 0, lowPrice: 0, currency: "VIDEO", resultUrl: "https://www.youtube.com/@SunChannelHK/videos", notice: "保存頻道來源，後續可接 RSS 自動更新。" },
      { queryText: "天下大勢", title: "政治新聞與時事影片追蹤", source: "YouTube / Bilibili", currentPrice: 0, highPrice: 0, lowPrice: 0, currency: "VIDEO", resultUrl: "https://www.youtube.com", notice: "用 queryText 保存頻道或關鍵字。" },
    ],
    cards: [
      { label: "來源", value: "channel / handle", note: "YouTube @handle 或頻道 URL" },
      { label: "列表", value: "recent videos", note: "保存最新影片與頻道摘要" },
      { label: "備註", value: "notice", note: "記錄頻道分類與更新狀態" },
    ],
  },
  finance: {
    title: "鋒兄金融",
    kicker: "FENGBRO FINANCE",
    description: "參考 SQLiteCloudFengBroAI 的 Yahoo Finance / Google Finance / TradingView 金融看板，保存指數、匯率、個股與警戒。",
    accent: "green",
    sources: [
      { label: "Yahoo Finance", url: "https://finance.yahoo.com", note: "美股、台股 ADR、匯率" },
      { label: "Google Finance", url: "https://www.google.com/finance", note: "市場總覽與快速查詢" },
      { label: "TradingView", url: "https://www.tradingview.com", note: "技術圖與指數觀察" },
    ],
    drafts: [
      { queryText: "USDTWD=X", title: "美元對台幣匯率", source: "Yahoo Finance", currentPrice: 31.61, highPrice: 32.5, lowPrice: 30.8, currency: "TWD", resultUrl: "https://finance.yahoo.com/quote/USDTWD=X", notice: "匯率觀察，可加警戒價。" },
      { queryText: "005930.KS", title: "Samsung Electronics", source: "Yahoo Finance", currentPrice: 41430, highPrice: 88800, lowPrice: 32000, currency: "KRW", resultUrl: "https://finance.yahoo.com/quote/005930.KS", notice: "參考金融截圖的三星、SK、指數與 Shiller PE。" },
    ],
    cards: [
      { label: "市場", value: "index / FX / stock", note: "台股、美股、匯率、個股" },
      { label: "警戒", value: "high / low", note: "用高低點欄位保存觀察線" },
      { label: "來源", value: "Yahoo / Google / TV", note: "保留 resultUrl 可回查" },
    ],
  },
};

function isToolChild(module: ModuleDef) {
  return module.parent === "tools" && Boolean(TOOL_WORKSPACES[module.id]);
}

function ToolWorkspace({
  module,
  records,
  onDraft,
}: {
  module: ModuleDef;
  records: RecordItem[];
  onDraft: (draft: Record<string, unknown>) => void;
}) {
  const config = TOOL_WORKSPACES[module.id];
  if (!config) return null;
  const numericValues = records.map((item) => Number(item.data.currentPrice)).filter((value) => Number.isFinite(value) && value > 0);
  const latest = records[0]?.data;
  const summary = {
    count: records.length,
    current: Number(latest?.currentPrice || 0),
    high: numericValues.length ? Math.max(...numericValues) : 0,
    low: numericValues.length ? Math.min(...numericValues) : 0,
  };

  return (
    <section className={`panel tool-workspace tool-workspace-${config.accent}`}>
      <div className="tool-workspace-hero">
        <div>
          <span className="tool-kicker">{config.kicker}</span>
          <h3>{config.title}</h3>
          <p>{config.description}</p>
        </div>
        <div className="tool-summary-pills">
          <span>{summary.count} 筆紀錄</span>
          <span>目前 {formatToolValue(summary.current, latest?.currency)}</span>
          <span>低點 {formatToolValue(summary.low, latest?.currency)}</span>
        </div>
      </div>

      <div className="tool-source-grid">
        {config.sources.map((source) => (
          <a href={source.url} target="_blank" rel="noreferrer" key={source.label}>
            <strong>{source.label}</strong>
            <span>{source.note}</span>
            <ExternalLink size={14} />
          </a>
        ))}
      </div>

      <div className="tool-card-grid">
        {config.cards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </div>

      <div className="tool-draft-box">
        <div>
          <h4>快速建立 {config.title} 查詢</h4>
          <p>範本會填入 queryText、source、價格/數值欄位與來源 URL，儲存後就成為目前資料庫的工具歷史。</p>
        </div>
        <div className="tool-draft-actions">
          {config.drafts.map((draft) => (
            <button type="button" className="ghost-button" key={String(draft.queryText)} onClick={() => onDraft({ ...draft, checkedAt: new Date().toISOString().slice(0, 16) })}>
              <Plus size={15} />
              {String(draft.queryText)}
            </button>
          ))}
        </div>
      </div>

      {records.length ? (
        <div className="tool-recent-list">
          <h4>最近工具紀錄</h4>
          {records.slice(0, 4).map((item) => (
            <article key={item.id}>
              <strong>{String(item.data.title || item.data.queryText || item.id)}</strong>
              <span>{String(item.data.source || module.label)} / {formatToolValue(Number(item.data.currentPrice || 0), item.data.currency)}</span>
              {item.data.resultUrl ? (
                <a href={String(item.data.resultUrl)} target="_blank" rel="noreferrer">
                  開啟來源 <ExternalLink size={13} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatToolValue(value: number, currency: unknown) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  const unit = String(currency || "TWD");
  return `${value.toLocaleString("zh-TW", { maximumFractionDigits: unit === "TWD" ? 0 : 2 })} ${unit}`;
}

function ToolsHub({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <section className="panel tools-hub">
      <div className="panel-heading">
        <div>
          <h3>鋒兄工具子項目</h3>
          <p>參考 SQLiteCloudFengBroAI：鋒兄比價、手機比價、鋒兄Tube、鋒兄金融，共用工具歷史欄位並直接寫入目前資料庫。</p>
        </div>
      </div>
      <div className="tool-child-grid">
        {TOOL_CHILD_MODULES.map((item) => (
          <button className="tool-child-card" type="button" key={item.id} onClick={() => onOpen(item.id)}>
            <item.icon size={22} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.subtitle}</small>
            </span>
            <ExternalLink size={17} />
          </button>
        ))}
      </div>
    </section>
  );
}

function AboutPanel() {
  return (
    <section className="panel guide">
      <h3>關於鋒兄 AI</h3>
      <p>TanStack Start 介面的鋒兄 CRUD 工作台，支援 CSV 匯入匯出、資料庫切換與 Bucket 檔案上傳。</p>
    </section>
  );
}

function compactForm(form: Record<string, unknown>, fields: FieldDef[]) {
  return Object.fromEntries(
    fields
      .filter((field) => field.type !== "file" || form[field.key])
      .map((field) => [field.key.replace(/File$/, ""), form[field.key]])
      .filter(([, value]) => value !== ""),
  );
}

function withToolDefaults(module: ModuleDef, payload: Record<string, unknown>) {
  const defaults = getToolDefaults(module);
  if (!Object.keys(defaults).length) return payload;
  return {
    ...defaults,
    ...payload,
    toolType: String(payload.toolType || defaults.toolType),
  };
}

function getToolDefaults(module: ModuleDef): Record<string, string> {
  const toolType = getToolType(module.id);
  return toolType ? { toolType, checkedAt: new Date().toISOString().slice(0, 16) } : {};
}

function getToolType(moduleId: string) {
  const map: Record<string, string> = {
    priceCompare: "price",
    phoneCompare: "mobile",
    tube: "tube",
    finance: "finance",
  };
  return map[moduleId] || "";
}

function readDbSettings(): DbSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_SETTINGS_KEY) || "null") as Partial<DbSettings> | null;
    return { ...DEFAULT_DB_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_DB_SETTINGS;
  }
}

function hasDbSettings(settings: DbSettings) {
  return Boolean(settings.provider && settings.connectionString.trim());
}

function dbHeaders(settings: DbSettings, json = true) {
  const headers: Record<string, string> = {
    "X-FengBro-DB-Config": encodeDbSettings(settings),
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function encodeDbSettings(settings: DbSettings) {
  const encoded = encodeURIComponent(JSON.stringify(settings)).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  return btoa(encoded);
}

async function readError(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text).error || text;
  } catch {
    return text || "Request failed";
  }
}
