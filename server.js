import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { errorStatus, getDeploymentEnvStatus, testConnectionTarget } from "./lib/connectionTester.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

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

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`RailwayFengBroAI settings server listening on ${PORT}`);
});
