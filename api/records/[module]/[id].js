import { createStoreFromRequest, handleError, requestBody, sendJson } from "../../_lib/dbStore.js";

export default async function handler(req, res) {
  const module = String(req.query.module || "");
  const id = String(req.query.id || "");
  if (!module || !id) {
    sendJson(res, 400, { ok: false, error: "Missing module or id" });
    return;
  }

  try {
    const store = await createStoreFromRequest(req);
    if (req.method === "PUT") {
      sendJson(res, 200, await store.update(module, id, requestBody(req)));
      return;
    }

    if (req.method === "DELETE") {
      await store.remove(module, id);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    handleError(res, error);
  }
}
