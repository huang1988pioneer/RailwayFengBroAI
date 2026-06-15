import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import healthHandler from "./api/health.js";
import recordsHandler from "./api/records/[module].js";
import recordHandler from "./api/records/[module]/[id].js";
import filesHandler from "./api/files/[key].js";
import setupHandler from "./api/setup.js";
import testBucketHandler from "./api/test-bucket.js";
import uploadUrlHandler from "./api/upload-url.js";
import uploadHandler from "./api/upload.js";
import { errorStatus, getDeploymentEnvStatus, testConnectionTarget } from "./lib/connectionTester.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

function withQuery(params, handler) {
  return (req, res) => {
    req.query = { ...req.query, ...params(req) };
    return handler(req, res);
  };
}

app.get("/api/env-status", (_req, res) => {
  res.json({
    ok: true,
    status: getDeploymentEnvStatus()
  });
});

app.post("/api/test-connection", async (req, res) => {
  const started = Date.now();

  try {
    const details = await testConnectionTarget(req.body || {});
    res.json({
      ok: true,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      details
    });
  } catch (error) {
    res.status(errorStatus(error)).json({
      ok: false,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      error: error.message || "Connection test failed."
    });
  }
});

app.get("/api/health", healthHandler);
app.post("/api/setup", setupHandler);
app.post("/api/test-bucket", testBucketHandler);
app.all("/api/records/:module", withQuery((req) => ({ module: req.params.module }), recordsHandler));
app.all("/api/records/:module/:id", withQuery((req) => ({ module: req.params.module, id: req.params.id }), recordHandler));
app.post("/api/upload", uploadHandler);
app.post("/api/upload-url", uploadUrlHandler);
app.get("/api/files/:key", withQuery((req) => ({ key: req.params.key }), filesHandler));

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`RailwayFengBroAI settings server listening on ${PORT}`);
});
