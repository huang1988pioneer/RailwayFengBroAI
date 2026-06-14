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
import { DATA_MODULES, FieldDef, ModuleDef, getModule, getPrimaryField } from "../lib/modules";
import { coerceCsvValue, parseCsv, toCsv } from "../lib/csv";

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
  filePath?: string;
  database?: string;
};

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const module = getModule(activeId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void loadHealth();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    resetForm(module);
    void loadRecords(module.id);
  }, [module.id, mounted]);

  async function loadHealth() {
    try {
      const response = await fetch("/api/health");
      setHealth(await response.json());
    } catch {
      setHealth({ ok: false });
    }
  }

  async function loadRecords(moduleId = activeId) {
    setLoading(true);
    try {
      const response = await fetch(`/api/records/${moduleId}`);
      setRecords(await response.json());
    } finally {
      setLoading(false);
    }
  }

  function resetForm(targetModule = module) {
    setEditing(null);
    setImportRows(null);
    setForm(Object.fromEntries(targetModule.fields.map((field) => [field.key, field.type === "boolean" ? false : ""])));
  }

  async function saveRecord(event: FormEvent) {
    event.preventDefault();
    const payload = compactForm(form, module.fields);
    if (!String(payload[getPrimaryField(module)] ?? "").trim()) {
      setNotice("請先填寫必填欄位。");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/records/${module.id}/${editing.id}` : `/api/records/${module.id}`;
      const method = editing ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      setNotice(editing ? "已更新資料。" : "已新增資料。");
      resetForm();
      await loadRecords();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "儲存失敗。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(item: RecordItem) {
    const title = String(item.data[getPrimaryField(module)] ?? item.id);
    if (!confirm(`確定刪除「${title}」？`)) return;
    await fetch(`/api/records/${module.id}/${item.id}`, { method: "DELETE" });
    setNotice("已刪除資料。");
    await loadRecords();
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
      setNotice(`已讀取 ${file.name}，請確認後匯入。`);
    };
    reader.readAsText(file, "utf-8");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function executeImport() {
    if (!importRows?.length) return;
    setSaving(true);
    let count = 0;
    try {
      for (const row of importRows) {
        const payload = Object.fromEntries(module.csvHeaders.map((header) => [header, coerceCsvValue(row[header] ?? "")]));
        const primary = getPrimaryField(module);
        const existing = records.find((item) => String(item.data[primary] ?? "") === String(payload[primary] ?? ""));
        const response = await fetch(existing ? `/api/records/${module.id}/${existing.id}` : `/api/records/${module.id}`, {
          method: existing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) count += 1;
      }
      setNotice(`CSV 匯入完成：${count} 筆。`);
      setImportRows(null);
      await loadRecords();
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
          <span>鋒兄 AI 管理台載入中</span>
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
            <h1>鋒兄 AI 管理台</h1>
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
              {health?.provider ?? "checking"}
            </span>
            <button className="ghost-button" type="button" onClick={() => loadRecords()}>
              重新整理
            </button>
          </div>
        </header>

        <section className="metrics">
          <Metric label="資料筆數" value={stats.total.toLocaleString("zh-TW")} />
          <Metric label="金額合計" value={stats.priced.toLocaleString("zh-TW")} />
          <Metric label="Bucket 檔案" value={stats.withFiles.toLocaleString("zh-TW")} />
        </section>

        {module.id === "settings" ? <SettingsGuide health={health} /> : null}
        {module.id === "about" ? <AboutPanel /> : null}

        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h3>{editing ? "編輯資料" : "新增資料"}</h3>
              <p>欄位依 Appwrite CSV header 建立，媒體類型可上傳至 Bucket。</p>
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
                onNotice={setNotice}
              />
            ))}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? <Loader2 className="spin" size={17} /> : editing ? <Check size={17} /> : <Plus size={17} />}
                {editing ? "儲存修改" : "新增資料"}
              </button>
              <button className="ghost-button" type="button" onClick={() => resetForm()}>
                清空
              </button>
              {notice ? <span className="notice">{notice}</span> : null}
            </div>
          </form>
        </section>

        <section className="panel">
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
                <p>偵測到 {importRows.length} 筆。相同主欄位會更新，否則新增。</p>
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

          {loading ? (
            <div className="empty-state"><Loader2 className="spin" />資料載入中</div>
          ) : filteredRecords.length ? (
            <RecordTable module={module} records={filteredRecords} onEdit={editRecord} onDelete={deleteRecord} />
          ) : (
            <div className="empty-state">尚無資料，先新增一筆或匯入 CSV。</div>
          )}
        </section>
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

function FieldControl({
  field,
  module,
  value,
  onChange,
  onNotice,
}: {
  field: FieldDef;
  module: ModuleDef;
  value: unknown;
  onChange: (value: unknown) => void;
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
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      onChange(payload.url);
      onNotice(`已上傳 ${file.name}。`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "上傳失敗。");
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className={field.wide || field.type === "textarea" || isFile ? "wide" : ""}>
      <span>{field.label}{field.required ? <b>*</b> : null}</span>
      {field.type === "textarea" ? (
        <textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : field.type === "boolean" ? (
        <span className="switch-row">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
          啟用 / 是
        </span>
      ) : isFile ? (
        <span className="upload-field">
          <input type="file" accept={field.accept} onChange={(event) => upload(event.target.files?.[0])} />
          {uploading ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />}
          {value ? <a href={String(value)} target="_blank" rel="noreferrer">已上傳檔案</a> : <em>{module.kind === "media" ? "可上傳至 Bucket" : "選擇檔案"}</em>}
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
            {visibleHeaders.map((header) => (
              <th key={header}>{header}</th>
            ))}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((item) => (
            <tr key={item.id}>
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

function SettingsGuide({ health }: { health: BackendHealth | null }) {
  return (
    <section className="panel guide">
      <h3>後端選擇</h3>
      <p>可用環境變數 `DB_PROVIDER=local|postgres|mysql|mongodb` 切換。未設定時會自動偵測 `DATABASE_PUBLIC_URL`、`POSTGRES_PUBLIC_URL`、`MYSQL_PUBLIC_URL`、`MONGO_PUBLIC_URL`。</p>
      <p>Bucket 使用 `BUCKET_ENDPOINT`、`BUCKET_NAME`、`BUCKET_ACCESS_KEY_ID`、`BUCKET_SECRET_ACCESS_KEY`、`BUCKET_REGION`。也相容 `S3_*` / `AWS_*` 命名；未設定時會寫入本機 `.data/uploads`。</p>
      <code>目前狀態：{health?.ok ? `${health.provider} ready` : "尚未連線"}</code>
    </section>
  );
}

function AboutPanel() {
  return (
    <section className="panel guide">
      <h3>關於鋒兄 AI 管理台</h3>
      <p>本版本選型 TanStack Start，參考 Appwrite 版資料欄位，提供所有鋒兄模組的 CRUD、CSV 匯入匯出與 Bucket 上傳。</p>
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
