import { createStoreFromRequest, handleError, sendJson } from "./_lib/dbStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const store = await createStoreFromRequest(req);
    const result = store.setup ? await store.setup() : await store.health();
    sendJson(res, 200, {
      ...result,
      message: "FengBro storage initialized.",
    });
  } catch (error) {
    handleError(res, error);
  }
}
