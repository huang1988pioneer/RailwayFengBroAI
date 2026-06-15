import { createStoreFromRequest, handleError, requestBody, sendJson } from "../_lib/dbStore.js";

export default async function handler(req, res) {
  const module = String(req.query.module || "");
  if (!module) {
    sendJson(res, 400, { ok: false, error: "Missing module" });
    return;
  }

  try {
    const store = await createStoreFromRequest(req);
    if (req.method === "GET") {
      sendJson(res, 200, await store.list(module));
      return;
    }

    if (req.method === "POST") {
      sendJson(res, 201, await store.create(module, requestBody(req)));
      return;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    handleError(res, error);
  }
}
