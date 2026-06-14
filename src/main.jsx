import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Box,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  KeyRound,
  Leaf,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Server,
  Settings,
  Waves
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "railway-fengbro-connection-settings";

const TARGETS = {
  mongodb: {
    name: "MongoDB",
    subtitle: "mongo-prod",
    icon: Leaf,
    accent: "#55d66b",
    hint: "支援 Railway 的 MONGO_URL 或 MONGO_PUBLIC_URL。",
    required: ["connectionName", "environment", "connectionString"],
    fields: [
      { key: "useDeploymentEnv", label: "使用部署環境變數", type: "checkbox" },
      { key: "connectionName", label: "連線名稱", placeholder: "mongo-prod" },
      { key: "environment", label: "環境", placeholder: "production" },
      { key: "connectionString", label: "連線字串", placeholder: "mongodb://user:password@host:port/db?authSource=admin", secret: true },
      { key: "databaseName", label: "資料庫名稱（選填）", placeholder: "admin" },
      { key: "authSource", label: "認證來源（選填）", placeholder: "admin" }
    ],
    seed: {
      connectionName: "mongo-prod",
      environment: "production",
      connectionString: "",
      databaseName: "admin",
      authSource: "admin",
      useDeploymentEnv: false
    }
  },
  postgres: {
    name: "Postgres",
    subtitle: "pg-prod",
    icon: Database,
    accent: "#64b5f6",
    hint: "支援 Railway 的 DATABASE_URL 或 DATABASE_PUBLIC_URL。",
    required: ["connectionName", "environment", "connectionString"],
    fields: [
      { key: "useDeploymentEnv", label: "使用部署環境變數", type: "checkbox" },
      { key: "connectionName", label: "連線名稱", placeholder: "pg-prod" },
      { key: "environment", label: "環境", placeholder: "production" },
      { key: "connectionString", label: "連線字串", placeholder: "postgresql://user:password@host:port/db", secret: true },
      { key: "databaseName", label: "資料庫名稱（選填）", placeholder: "railway" },
      { key: "ssl", label: "啟用 SSL", type: "checkbox" }
    ],
    seed: {
      connectionName: "pg-prod",
      environment: "production",
      connectionString: "",
      databaseName: "",
      ssl: true,
      useDeploymentEnv: false
    }
  },
  mysql: {
    name: "MySQL",
    subtitle: "mysql-prod",
    icon: Waves,
    accent: "#16a6d9",
    hint: "支援 Railway 的 MYSQL_URL 或 MYSQL_PUBLIC_URL。",
    required: ["connectionName", "environment", "connectionString"],
    fields: [
      { key: "useDeploymentEnv", label: "使用部署環境變數", type: "checkbox" },
      { key: "connectionName", label: "連線名稱", placeholder: "mysql-prod" },
      { key: "environment", label: "環境", placeholder: "production" },
      { key: "connectionString", label: "連線字串", placeholder: "mysql://user:password@host:port/db", secret: true },
      { key: "databaseName", label: "資料庫名稱（選填）", placeholder: "railway" },
      { key: "ssl", label: "啟用 SSL", type: "checkbox" }
    ],
    seed: {
      connectionName: "mysql-prod",
      environment: "production",
      connectionString: "",
      databaseName: "",
      ssl: false,
      useDeploymentEnv: false
    }
  },
  bucket: {
    name: "Bucket",
    subtitle: "portable-cage",
    icon: Box,
    accent: "#d8dce7",
    hint: "支援 Railway Bucket 的 S3-compatible credentials。",
    required: ["connectionName", "environment", "endpoint", "region", "bucketName", "accessKeyId", "secretAccessKey"],
    fields: [
      { key: "useDeploymentEnv", label: "使用部署環境變數", type: "checkbox" },
      { key: "connectionName", label: "連線名稱", placeholder: "portable-cage" },
      { key: "environment", label: "環境", placeholder: "production" },
      { key: "endpoint", label: "Endpoint URL", placeholder: "https://t3.storageapi.dev" },
      { key: "region", label: "Region", placeholder: "auto" },
      { key: "bucketName", label: "Bucket Name", placeholder: "portable-cage-z5yt07ol-lu" },
      { key: "accessKeyId", label: "Access Key ID", placeholder: "輸入 Access Key ID", secret: true },
      { key: "secretAccessKey", label: "Secret Access Key", placeholder: "輸入 Secret Access Key", secret: true }
    ],
    seed: {
      connectionName: "portable-cage",
      environment: "production",
      endpoint: "https://t3.storageapi.dev",
      region: "auto",
      bucketName: "",
      accessKeyId: "",
      secretAccessKey: "",
      useDeploymentEnv: false
    }
  }
};

function maskSecret(value) {
  if (!value) return "";
  return value
    .replace(/:\/\/([^:/?#]+):([^@]+)@/g, "://$1:******@")
    .replace(/(accessKeyId|secretAccessKey)=([^&\s]+)/gi, "$1=******");
}

function buildInitialValues() {
  return Object.fromEntries(Object.entries(TARGETS).map(([key, target]) => [key, target.seed]));
}

function loadInitialValues() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const defaults = buildInitialValues();
    return Object.fromEntries(
      Object.entries(defaults).map(([key, seed]) => [key, { ...seed, ...(saved[key] || {}) }])
    );
  } catch {
    return buildInitialValues();
  }
}

function App() {
  const [active, setActive] = useState("mongodb");
  const [values, setValues] = useState(loadInitialValues);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const target = TARGETS[active];

  const completed = useMemo(() => {
    const current = values[active];
    if (current.useDeploymentEnv) return target.required.length;
    return target.required.filter((key) => String(current[key] || "").trim()).length;
  }, [active, target, values]);

  const preview = useMemo(() => {
    const current = values[active];
    if (current.useDeploymentEnv) {
      return `${target.name} credentials 將由部署環境變數提供`;
    }
    if (active === "bucket") {
      return `${current.endpoint || "https://t3.storageapi.dev"}/${current.bucketName || "<bucket-name>"} · region=${current.region || "auto"}`;
    }
    return maskSecret(current.connectionString) || target.fields.find((field) => field.key === "connectionString")?.placeholder;
  }, [active, target.fields, values]);

  function updateValue(key, value) {
    setValues((previous) => ({
      ...previous,
      [active]: {
        ...previous[active],
        [key]: value
      }
    }));
  }

  async function testConnection() {
    setTesting(true);
    setResult(null);
    const stamp = new Date().toLocaleTimeString("zh-TW", { hour12: false });
    setLogs((previous) => [`${stamp} 開始測試 ${target.name}...`, ...previous].slice(0, 8));

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: active, ...values[active] })
      });
      const payload = await response.json();
      setResult(payload);
      setLogs((previous) => [
        `${stamp} ${payload.ok ? "測試完成：成功" : `測試失敗：${payload.error}`}`,
        ...previous
      ].slice(0, 8));
    } catch (error) {
      const payload = { ok: false, error: error.message, latencyMs: 0, checkedAt: new Date().toISOString() };
      setResult(payload);
      setLogs((previous) => [`${stamp} 測試失敗：${error.message}`, ...previous].slice(0, 8));
    } finally {
      setTesting(false);
    }
  }

  function resetForm() {
    setValues((previous) => ({ ...previous, [active]: target.seed }));
    setResult(null);
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    const stamp = new Date().toLocaleTimeString("zh-TW", { hour12: false });
    setLogs((previous) => [`${stamp} 已保存目前設定到此瀏覽器。`, ...previous].slice(0, 8));
  }

  const Icon = target.icon;

  return (
    <main className="app-shell">
      <aside className="rail">
        <Settings className="rail-icon active" aria-hidden="true" />
        <Server className="rail-icon" aria-hidden="true" />
        <KeyRound className="rail-icon" aria-hidden="true" />
      </aside>

      <section className="sidebar" aria-label="連線目標">
        <header className="brand">
          <div>
            <h1>鋒兄設定</h1>
            <p>Railway 服務連線檢查</p>
          </div>
          <button className="icon-button" aria-label="保存設定" onClick={saveSettings}>
            <Save size={17} />
          </button>
        </header>

        <div className="target-list">
          {Object.entries(TARGETS).map(([key, item]) => {
            const TargetIcon = item.icon;
            const selected = key === active;
            return (
              <button
                key={key}
                className={`target-card ${selected ? "selected" : ""}`}
                onClick={() => {
                  setActive(key);
                  setResult(null);
                }}
                style={{ "--accent": item.accent }}
              >
                <TargetIcon size={30} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <em>{selected ? "編輯中" : "可選擇"}</em>
              </button>
            );
          })}
        </div>

        <footer className="project-card">
          <span>目前環境</span>
          <strong>production</strong>
          <small>project · delightful-courage</small>
        </footer>
      </section>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <h2>測試連線</h2>
            <p>選擇 MongoDB、Postgres、MySQL 或 Bucket，填入 Railway credentials 後立即檢查。</p>
          </div>
          <button className="secondary-button" onClick={resetForm}>
            <RefreshCw size={16} />
            重設表單
          </button>
        </header>

        <nav className="tabs" aria-label="連線目標分頁">
          {Object.entries(TARGETS).map(([key, item]) => (
            <button key={key} className={key === active ? "active" : ""} onClick={() => setActive(key)}>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="content-grid">
          <form className="settings-panel" onSubmit={(event) => event.preventDefault()}>
            <div className="section-heading">
              <Icon size={24} style={{ color: target.accent }} />
              <div>
                <h3>{target.name} 連線設定</h3>
                <p>{target.hint}</p>
              </div>
            </div>

            <div className="field-grid">
              {target.fields.map((field) => (
                <label key={field.key} className={field.key === "connectionString" || field.key === "secretAccessKey" ? "wide" : ""}>
                  {field.type === "checkbox" ? (
                    <span className="check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(values[active][field.key])}
                        onChange={(event) => updateValue(field.key, event.target.checked)}
                      />
                      {field.label}
                    </span>
                  ) : (
                    <>
                      <span>{field.label}{target.required.includes(field.key) ? <b>*</b> : null}</span>
                      <input
                        type={field.secret ? "password" : "text"}
                        value={values[active][field.key] || ""}
                        placeholder={field.placeholder}
                        onChange={(event) => updateValue(field.key, event.target.value)}
                      />
                    </>
                  )}
                </label>
              ))}
            </div>

            <div className="preview-box">
              <span>端點預覽</span>
              <code>{preview}</code>
              <button type="button" className="icon-button" onClick={() => navigator.clipboard?.writeText(preview)}>
                <Copy size={16} />
              </button>
            </div>

            <div className="actions">
              <button className="primary-button" type="button" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
                {testing ? "測試中" : "測試連線"}
              </button>
              <span>{completed} / {target.required.length} 必要欄位完成</span>
            </div>
          </form>

          <aside className="status-panel">
            <section>
              <h3>必要欄位</h3>
              <div className="checklist">
                {target.required.map((key) => {
                  const ok = String(values[active][key] || "").trim().length > 0;
                  const envMode = Boolean(values[active].useDeploymentEnv);
                  const label = target.fields.find((field) => field.key === key)?.label || key;
                  return (
                    <div key={key} className={ok || envMode ? "ok" : ""}>
                      {ok || envMode ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
                      <span>{label.replace("（選填）", "")}</span>
                    </div>
                  );
                })}
              </div>
              <div className="progress" aria-label="必要欄位完成度">
                <span style={{ width: `${(completed / target.required.length) * 100}%` }} />
              </div>
            </section>

            <section className={`result-card ${result?.ok ? "success" : result ? "error" : ""}`}>
              <div className="result-title">
                <h3>測試結果</h3>
                {result ? <small>{result.latencyMs} ms</small> : <Clock3 size={17} />}
              </div>
              {result ? (
                <>
                  <strong>{result.ok ? "連線成功" : "連線失敗"}</strong>
                  <p>{result.ok ? result.details?.response : result.error}</p>
                  <dl>
                    <dt>目標</dt>
                    <dd>{result.details?.target || target.name}</dd>
                    <dt>時間</dt>
                    <dd>{new Date(result.checkedAt).toLocaleString("zh-TW", { hour12: false })}</dd>
                  </dl>
                </>
              ) : (
                <p>尚未測試。填完必要欄位後按下測試連線。</p>
              )}
            </section>

            <section>
              <h3>紀錄</h3>
              <ul className="log-list">
                {logs.length ? logs.map((log) => <li key={log}>{log}</li>) : <li>等待第一次測試...</li>}
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
