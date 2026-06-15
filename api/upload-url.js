import { createPresignedUpload } from "./_lib/bucket.js";
import { handleError, requestBody, sendJson } from "./_lib/dbStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = requestBody(req);
    if (!body?.name) {
      sendJson(res, 400, { ok: false, error: "Missing file name" });
      return;
    }

    const result = await createPresignedUpload(
      {
        name: String(body.name),
        type: String(body.type || "application/octet-stream"),
        size: Number(body.size || 0),
      },
      {
        module: String(body.module || ""),
        field: String(body.field || ""),
      },
    );
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}
