import { errorStatus, testConnectionTarget } from "../lib/connectionTester.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const started = Date.now();
  try {
    const details = await testConnectionTarget({ ...(req.body || {}), target: "bucket" });
    res.status(200).json({
      ok: true,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      details,
    });
  } catch (error) {
    res.status(errorStatus(error)).json({
      ok: false,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      error: error.message || "Bucket test failed.",
    });
  }
}
