import { errorStatus, testConnectionTarget } from "../lib/connectionTester.js";

function readBody(req) {
  if (!req.body || typeof req.body === "object") return req.body || {};
  try {
    return JSON.parse(req.body);
  } catch {
    const err = new Error("Request body must be valid JSON.");
    err.statusCode = 200;
    throw err;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const started = Date.now();

  try {
    const details = await testConnectionTarget(readBody(req));
    res.status(200).json({
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
}
