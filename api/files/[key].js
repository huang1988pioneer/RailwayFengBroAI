import { readBucketObject } from "../_lib/bucket.js";
import { handleError } from "../_lib/dbStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const key = decodeURIComponent(String(req.query.key || ""));
    if (!key) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "Missing key" }));
      return;
    }

    const file = await readBucketObject(key);
    res.statusCode = 200;
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    for await (const chunk of file.body) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    handleError(res, error);
  }
}
