import { createStoreFromRequest, handleError, sendJson } from "./_lib/dbStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const store = await createStoreFromRequest(req);
    sendJson(res, 200, await store.health());
  } catch (error) {
    handleError(res, error);
  }
}
